import type { EventType } from '@prisma/client';

export type IngestionContext = {
  apiKeyId: string;
  organizationId: string;
  projectId: string;
  serviceId: string;
  environmentId: string;
};

export type NormalizedEvent = {
  id: string;
  organizationId: string;
  projectId: string;
  serviceId: string;
  serviceEnvironmentId: string;
  apiKeyId: string;
  type: EventType;
  level: string;
  message: string;
  source: string;
  timestamp: string;
  traceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

declare global {
  namespace Express {
    interface Request {
      ingestionContext?: IngestionContext;
    }
  }
}

export {};
