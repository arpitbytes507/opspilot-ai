import { Worker } from 'bullmq';
import { Prisma } from '@prisma/client';

import { config } from '../config/env';
import { closeRedis, getRedisClient } from '../lib/redis';
import { eventQueueName } from '../queues/eventQueue';
import type { NormalizedEvent } from '../types/ingestion';
import { prisma } from '../lib/prisma';
import { evaluateEventForIncidentDetection } from '../services/detectionService';

export const processEvent = async (event: NormalizedEvent): Promise<void> => {
  console.info(JSON.stringify({ message: 'Telemetry event persistence started', eventId: event.id, organizationId: event.organizationId, projectId: event.projectId, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));
  try {
    await prisma.event.create({
      data: {
        id: event.id,
        organizationId: event.organizationId,
        projectId: event.projectId,
        serviceId: event.serviceId,
        serviceEnvironmentId: event.serviceEnvironmentId,
        type: event.type,
        level: event.level,
        message: event.message,
        source: event.source,
        timestamp: new Date(event.timestamp),
        traceId: event.traceId,
        requestId: event.requestId,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
        payload: event.payload as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
  console.info(JSON.stringify({ message: 'Telemetry event persisted', eventId: event.id, organizationId: event.organizationId, projectId: event.projectId, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));

  try {
    console.info(JSON.stringify({ message: 'Incident detection started', eventId: event.id, organizationId: event.organizationId, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));
    const detection = await evaluateEventForIncidentDetection(event);
    if (detection) {
      console.info(JSON.stringify({
        message: 'Incident detection rule triggered',
        eventId: event.id,
        rule: detection.rule,
        severity: detection.severity,
        organizationId: event.organizationId,
        serviceId: event.serviceId,
        environmentId: event.serviceEnvironmentId,
      }));
    }
  } catch (error: unknown) {
    console.error(JSON.stringify({
      message: 'Incident detection failed after telemetry persisted',
      eventId: event.id,
      serviceId: event.serviceId,
      environmentId: event.serviceEnvironmentId,
      organizationId: event.organizationId,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  if (!event.apiKeyId) return;

  try {
    await prisma.apiKey.update({ where: { id: event.apiKeyId }, data: { lastUsedAt: new Date() } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === 'P2025') {
      return;
    }
    console.warn(JSON.stringify({
      message: 'API key usage timestamp update failed',
      eventId: event.id,
      apiKeyId: event.apiKeyId,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
};

export const startEventWorker = (): Worker<NormalizedEvent> => {
  console.info(JSON.stringify({ message: 'Telemetry event worker starting', queue: eventQueueName, redisConfigured: Boolean(config.redisUrl) }));
  const worker = new Worker<NormalizedEvent>(eventQueueName, async (job) => {
    const event = job.data;
    console.info(JSON.stringify({ message: 'Telemetry event job received', eventId: event.id, queue: eventQueueName, organizationId: event.organizationId, projectId: event.projectId, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));
    await processEvent(event);
    console.info(JSON.stringify({ message: 'Telemetry event processed', eventId: event.id, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));
  }, { connection: getRedisClient(), concurrency: 10 });

  worker.on('failed', (job, error) => {
    console.error(JSON.stringify({ message: 'Telemetry event processing failed', eventId: job?.data.id, error: error.message }));
  });
  worker.on('error', (error) => {
    console.error(JSON.stringify({ message: 'Telemetry event worker error', error: error.message }));
  });
  worker.on('ready', () => {
    console.info(JSON.stringify({ message: 'Telemetry event worker ready', queue: eventQueueName }));
  });
  return worker;
};

export const stopEventWorker = async (worker: Worker<NormalizedEvent>): Promise<void> => {
  await worker.close();
  await closeRedis();
  await prisma.$disconnect();
};
