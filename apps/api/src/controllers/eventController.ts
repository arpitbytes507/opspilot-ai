import type { Request, Response } from 'express';

import { enqueueEvent } from '../services/eventService';
import { eventPayloadSchema, idempotencyKeySchema } from '../validators/eventValidators';
import { HttpError } from '../utils/httpError';

export const ingestEvent = async (req: Request, res: Response): Promise<void> => {
  if (!req.ingestionContext) throw new HttpError(401, 'INVALID_INGESTION_CREDENTIALS', 'Invalid ingestion credentials');
  const input = eventPayloadSchema.parse(req.body);
  const header = req.get('idempotency-key');
  const idempotencyKey = header ? idempotencyKeySchema.parse(header) : undefined;
  const result = await enqueueEvent(req.ingestionContext, input, idempotencyKey);
  console.info(JSON.stringify({
    message: result.duplicate ? 'Telemetry event deduplicated' : 'Telemetry event accepted',
    requestId: req.get('x-request-id') || 'unknown',
    eventId: result.eventId,
    serviceId: req.ingestionContext.serviceId,
    environmentId: req.ingestionContext.environmentId,
  }));
  res.status(202).json({
    success: true,
    message: result.duplicate ? 'Event was already accepted' : 'Event accepted for processing',
    data: { eventId: result.eventId, status: result.duplicate ? 'duplicate' : 'queued' },
  });
};
