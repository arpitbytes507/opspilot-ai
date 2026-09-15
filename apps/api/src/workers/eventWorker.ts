import { Worker } from 'bullmq';
import { Prisma } from '@prisma/client';

import { closeRedis, getRedisClient } from '../lib/redis';
import { eventQueueName } from '../queues/eventQueue';
import type { NormalizedEvent } from '../types/ingestion';
import { prisma } from '../lib/prisma';

export const processEvent = async (event: NormalizedEvent): Promise<void> => {
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
  await prisma.apiKey.update({ where: { id: event.apiKeyId }, data: { lastUsedAt: new Date() } });
};

export const startEventWorker = (): Worker<NormalizedEvent> => {
  const worker = new Worker<NormalizedEvent>(eventQueueName, async (job) => {
    const event = job.data;
    await processEvent(event);
    console.info(JSON.stringify({ message: 'Telemetry event processed', eventId: event.id, serviceId: event.serviceId, environmentId: event.serviceEnvironmentId }));
  }, { connection: getRedisClient(), concurrency: 10 });

  worker.on('failed', (job, error) => {
    console.error(JSON.stringify({ message: 'Telemetry event processing failed', eventId: job?.data.id, error: error.message }));
  });
  return worker;
};

export const stopEventWorker = async (worker: Worker<NormalizedEvent>): Promise<void> => {
  await worker.close();
  await closeRedis();
  await prisma.$disconnect();
};
