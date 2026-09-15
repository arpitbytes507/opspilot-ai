import { z } from 'zod';

const boundedJsonObject = z.record(z.unknown()).superRefine((value, context) => {
  if (JSON.stringify(value).length > 32_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Object exceeds the maximum size' });
  }
});

export const eventPayloadSchema = z.object({
  type: z.enum(['ERROR', 'WARNING', 'INFO', 'PERFORMANCE', 'DEPLOYMENT']),
  level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']),
  message: z.string().trim().min(1).max(10_000),
  source: z.string().trim().min(1).max(200).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  traceId: z.string().trim().min(1).max(256).optional(),
  requestId: z.string().trim().min(1).max(256).optional(),
  metadata: boundedJsonObject.optional(),
  payload: boundedJsonObject.optional(),
}).strict();

export const idempotencyKeySchema = z.string().trim().min(1).max(256);

export type EventPayload = z.infer<typeof eventPayloadSchema>;
