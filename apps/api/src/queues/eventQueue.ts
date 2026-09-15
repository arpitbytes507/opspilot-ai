import { Queue } from 'bullmq';

import { getRedisClient } from '../lib/redis';
import type { NormalizedEvent } from '../types/ingestion';

export const eventQueueName = 'event-processing';

let eventQueue: Queue<NormalizedEvent> | undefined;

export const getEventQueue = (): Queue<NormalizedEvent> => {
  eventQueue ??= new Queue<NormalizedEvent>(eventQueueName, {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 604_800, count: 10_000 },
    },
  });
  return eventQueue;
};

export const closeEventQueue = async (): Promise<void> => {
  if (eventQueue) {
    await eventQueue.close();
    eventQueue = undefined;
  }
};
