import { createHash } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  const counters = new Map<string, number>();
  const redis = {
    incr: vi.fn(async (key: string) => { const count = (counters.get(key) || 0) + 1; counters.set(key, count); return count; }),
    expire: vi.fn(async () => 1),
    get: vi.fn(async (key: string) => values.get(key) || null),
    set: vi.fn(async (key: string, value: string) => { if (values.has(key)) return null; values.set(key, value); return 'OK'; }),
    del: vi.fn(async (key: string) => { values.delete(key); return 1; }),
    reset: () => { values.clear(); counters.clear(); },
  };
  const queue = { add: vi.fn(async () => ({ id: 'job-id' })) };
  return { redis, queue };
});

vi.mock('../src/lib/redis', () => ({ getRedisClient: () => mocks.redis, closeRedis: vi.fn(async () => undefined) }));
vi.mock('../src/queues/eventQueue', () => ({ getEventQueue: () => mocks.queue, closeEventQueue: vi.fn(async () => undefined), eventQueueName: 'event-processing' }));

process.env.AUTH_SECRET = 'test-auth-secret-that-is-at-least-32-characters';
process.env.AUTH_COOKIE_NAME = 'event_test_auth';
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://test';
process.env.INGEST_RATE_LIMIT_MAX = '2';
process.env.INGEST_RATE_LIMIT_WINDOW_SECONDS = '60';
process.env.INGEST_IDEMPOTENCY_TTL_SECONDS = '60';

const { default: app } = await import('../src/app');
const { prisma } = await import('../src/lib/prisma');
const { processEvent } = await import('../src/workers/eventWorker');

const apiKeyFindUnique = vi.spyOn(prisma.apiKey, 'findUnique');
const eventCreate = vi.spyOn(prisma.event, 'create');
const apiKeyUpdate = vi.spyOn(prisma.apiKey, 'update');

const secret = 'opspk_test_secret_for_ingestion_123456789';
const contextRecord = {
  id: '00000000-0000-4000-8000-000000000201',
  organizationId: '00000000-0000-4000-8000-000000000202',
  revokedAt: null,
  expiresAt: null,
  serviceEnvironment: {
    id: '00000000-0000-4000-8000-000000000203',
    organizationId: '00000000-0000-4000-8000-000000000202',
    serviceId: '00000000-0000-4000-8000-000000000204',
    service: { projectId: '00000000-0000-4000-8000-000000000205', organizationId: '00000000-0000-4000-8000-000000000202', project: { organizationId: '00000000-0000-4000-8000-000000000202' } },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.reset();
  mocks.queue.add.mockResolvedValue({ id: 'job-id' });
  apiKeyFindUnique.mockResolvedValue(contextRecord as never);
  eventCreate.mockResolvedValue({} as never);
  apiKeyUpdate.mockResolvedValue({} as never);
});

describe('telemetry ingestion', () => {
  it('accepts a valid event and binds ownership from the API key', async () => {
    const response = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${secret}`)
      .send({ type: 'ERROR', level: 'ERROR', message: 'Database timeout', organizationId: 'attacker-org', metadata: { safe: true } });

    expect(response.status).toBe(400);

    const accepted = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${secret}`)
      .send({ type: 'ERROR', level: 'ERROR', message: 'Database timeout', metadata: { safe: true } });
    expect(accepted.status).toBe(202);
    expect(accepted.body.data.status).toBe('queued');
    expect(mocks.queue.add).toHaveBeenCalledWith('persist-event', expect.objectContaining({
      organizationId: contextRecord.organizationId,
      projectId: contextRecord.serviceEnvironment.service.projectId,
      serviceId: contextRecord.serviceEnvironment.serviceId,
      serviceEnvironmentId: contextRecord.serviceEnvironment.id,
    }), expect.objectContaining({ jobId: expect.any(String) }));
  });

  it('rejects missing, malformed, revoked, and expired credentials generically', async () => {
    expect((await request(app).post('/api/v1/events').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/events').set('Authorization', 'Bearer invalid').send({})).status).toBe(401);
    apiKeyFindUnique.mockResolvedValueOnce({ ...contextRecord, revokedAt: new Date() } as never);
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({})).body.error.message).toBe('Invalid ingestion credentials');
    apiKeyFindUnique.mockResolvedValueOnce({ ...contextRecord, expiresAt: new Date(Date.now() - 1000) } as never);
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({})).status).toBe(401);
  });

  it('rejects invalid event types, malformed timestamps, and oversized messages', async () => {
    const base = { level: 'ERROR', message: 'bad' };
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({ ...base, type: 'CUSTOM' })).status).toBe(400);
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({ ...base, type: 'ERROR', timestamp: 'tomorrow' })).status).toBe(400);
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({ ...base, type: 'ERROR', message: 'x'.repeat(10_001) })).status).toBe(400);
  });

  it('deduplicates by API key and idempotency key and enforces rate limits', async () => {
    const body = { type: 'INFO', level: 'INFO', message: 'same event' };
    const first = await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).set('Idempotency-Key', 'event-1').send(body);
    const duplicate = await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).set('Idempotency-Key', 'event-1').send(body);
    expect(first.status).toBe(202);
    expect(duplicate.body.data.status).toBe('duplicate');
    expect(mocks.queue.add).toHaveBeenCalledTimes(1);
    await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send(body);
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send(body)).status).toBe(429);
  });

  it('returns a service error when queueing fails and worker persistence stores the normalized event', async () => {
    mocks.queue.add.mockRejectedValueOnce(new Error('redis down'));
    expect((await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({ type: 'INFO', level: 'INFO', message: 'queue failure' })).status).toBe(503);
    await processEvent({ id: '00000000-0000-4000-8000-000000000206', apiKeyId: contextRecord.id, organizationId: contextRecord.organizationId, projectId: contextRecord.serviceEnvironment.service.projectId, serviceId: contextRecord.serviceEnvironment.serviceId, serviceEnvironmentId: contextRecord.serviceEnvironment.id, type: 'INFO', level: 'INFO', message: 'persisted', source: 'test', timestamp: new Date().toISOString() });
    expect(eventCreate).toHaveBeenCalled();
    expect(apiKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: contextRecord.id } }));
  });

  it('hashes the bearer secret before lookup', async () => {
    await request(app).post('/api/v1/events').set('Authorization', `Bearer ${secret}`).send({ type: 'INFO', level: 'INFO', message: 'hash me' });
    expect(apiKeyFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { keyHash: createHash('sha256').update(secret).digest('hex') } }));
  });
});
