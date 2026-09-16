import dotenv from 'dotenv';

dotenv.config();

export const config = {
  get port(): number { return Number(process.env.PORT || 8000); },
  get nodeEnv(): string { return process.env.NODE_ENV || 'development'; },
  get authCookieName(): string { return process.env.AUTH_COOKIE_NAME || 'opspilot_auth'; },
  get authSecret(): string { return process.env.AUTH_SECRET || ''; },
  get webOrigin(): string { return process.env.WEB_ORIGIN || 'http://localhost:3000'; },
  get redisUrl(): string { return process.env.REDIS_URL || ''; },
  get ingestRateLimitMax(): number { return Number(process.env.INGEST_RATE_LIMIT_MAX || 600); },
  get ingestRateLimitWindowSeconds(): number { return Number(process.env.INGEST_RATE_LIMIT_WINDOW_SECONDS || 60); },
  get ingestIdempotencyTtlSeconds(): number { return Number(process.env.INGEST_IDEMPOTENCY_TTL_SECONDS || 86_400); },
  get ingestBodyLimit(): string { return process.env.INGEST_BODY_LIMIT || '256kb'; },
  get errorBurstThreshold(): number { return Number(process.env.ERROR_BURST_THRESHOLD || 10); },
  get errorBurstWindowSeconds(): number { return Number(process.env.ERROR_BURST_WINDOW_SECONDS || 300); },
  get incidentCorrelationWindowSeconds(): number { return Number(process.env.INCIDENT_CORRELATION_WINDOW_SECONDS || 900); },
  get performanceLatencyThresholdMs(): number { return Number(process.env.PERFORMANCE_LATENCY_THRESHOLD_MS || 2000); },
  get performanceDegradationThreshold(): number { return Number(process.env.PERFORMANCE_DEGRADATION_THRESHOLD || 10); },
};
