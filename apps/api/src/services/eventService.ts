import { createHash, randomUUID } from 'node:crypto';
import type Redis from 'ioredis';

import { config } from '../config/env';
import { getRedisClient } from '../lib/redis';
import { eventQueueName, getEventQueue } from '../queues/eventQueue';
import type { IngestionContext, NormalizedEvent } from '../types/ingestion';
import { eventPayloadSchema, type EventPayload } from '../validators/eventValidators';
import { HttpError } from '../utils/httpError';

const idempotencyPrefix = 'telemetry:idempotency:';
const rateLimitPrefix = 'telemetry:rate:';

const redisUnavailable = (): never => {
  throw new HttpError(503, 'INGESTION_UNAVAILABLE', 'Telemetry ingestion is temporarily unavailable');
};

const safeRedis = (): Redis => {
  try {
    return getRedisClient();
  } catch (_error: unknown) {
    return redisUnavailable();
  }
};

const checkRateLimit = async (apiKeyId: string): Promise<void> => {
  const redis = safeRedis();
  const key = `${rateLimitPrefix}${apiKeyId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, config.ingestRateLimitWindowSeconds);
    if (count > config.ingestRateLimitMax) throw new HttpError(429, 'INGESTION_RATE_LIMITED', 'Telemetry ingestion rate limit exceeded');
  } catch (error: unknown) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'INGESTION_UNAVAILABLE', 'Telemetry ingestion is temporarily unavailable');
  }
};

const idempotencyKeyFor = (apiKeyId: string, idempotencyKey: string): string => (
  `${idempotencyPrefix}${apiKeyId}:${createHash('sha256').update(idempotencyKey).digest('hex')}`
);

export const enqueueEvent = async (
  context: IngestionContext,
  input: EventPayload,
  idempotencyKey?: string,
): Promise<{ eventId: string; duplicate: boolean }> => {
  const parsed = eventPayloadSchema.parse(input);
  await checkRateLimit(context.apiKeyId);
  const eventId = randomUUID();
  const redis = safeRedis();
  let claimedKey: string | undefined;

  if (idempotencyKey) {
    claimedKey = idempotencyKeyFor(context.apiKeyId, idempotencyKey);
    try {
      const previousEventId = await redis.get(claimedKey);
      if (previousEventId) return { eventId: previousEventId, duplicate: true };
      const claimed = await redis.set(claimedKey, eventId, 'EX', config.ingestIdempotencyTtlSeconds, 'NX');
      if (claimed !== 'OK') return { eventId: (await redis.get(claimedKey)) || eventId, duplicate: true };
    } catch (_error: unknown) {
      throw new HttpError(503, 'INGESTION_UNAVAILABLE', 'Telemetry ingestion is temporarily unavailable');
    }
  }

  const event: NormalizedEvent = {
    id: eventId,
    organizationId: context.organizationId,
    projectId: context.projectId,
    serviceId: context.serviceId,
    serviceEnvironmentId: context.environmentId,
    apiKeyId: context.apiKeyId,
    type: parsed.type,
    level: parsed.level,
    message: parsed.message,
    source: parsed.source || 'unknown',
    timestamp: parsed.timestamp ? new Date(parsed.timestamp).toISOString() : new Date().toISOString(),
    traceId: parsed.traceId,
    requestId: parsed.requestId,
    metadata: parsed.metadata,
    payload: parsed.payload,
  };

  try {
    await getEventQueue().add('persist-event', event, { jobId: event.id });
    console.info(JSON.stringify({ message: 'Telemetry event queued', eventId: event.id, queue: eventQueueName, organizationId: event.organizationId, projectId: event.projectId, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));
  } catch (error: unknown) {
    if (claimedKey) {
      try { await redis.del(claimedKey); } catch { }
    }
    throw new HttpError(503, 'INGESTION_UNAVAILABLE', 'Telemetry ingestion is temporarily unavailable');
  }

  return { eventId: event.id, duplicate: false };
};
