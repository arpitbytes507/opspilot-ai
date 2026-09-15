import Redis from 'ioredis';

import { config } from '../config/env';

let redisClient: Redis | undefined;

export const getRedisClient = (): Redis => {
  if (!config.redisUrl) throw new Error('REDIS_URL is not configured');
  if (!config.redisUrl.startsWith('redis://') && !config.redisUrl.startsWith('rediss://')) {
    throw new Error('REDIS_URL must use redis:// or rediss:// for BullMQ');
  }
  redisClient ??= new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = undefined;
  }
};
