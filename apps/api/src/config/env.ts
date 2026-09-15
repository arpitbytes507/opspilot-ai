import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8000),
  nodeEnv: process.env.NODE_ENV || 'development',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'opspilot_auth',
  authSecret: process.env.AUTH_SECRET || '',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL || '',
  ingestRateLimitMax: Number(process.env.INGEST_RATE_LIMIT_MAX || 600),
  ingestRateLimitWindowSeconds: Number(process.env.INGEST_RATE_LIMIT_WINDOW_SECONDS || 60),
  ingestIdempotencyTtlSeconds: Number(process.env.INGEST_IDEMPOTENCY_TTL_SECONDS || 86_400),
  ingestBodyLimit: process.env.INGEST_BODY_LIMIT || '256kb',
};
