import { z } from 'zod';

export const incidentIdParamsSchema = z.object({ incidentId: z.string().uuid() });

export const incidentListQuerySchema = z.object({
  status: z.enum(['DETECTED', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'POSTMORTEM']).optional(),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  serviceId: z.string().uuid().optional(),
  environmentId: z.string().uuid().optional(),
  sort: z.enum(['newest', 'oldest', 'severity', 'updated']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateIncidentSchema = z.object({
  status: z.enum(['DETECTED', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'POSTMORTEM']).optional(),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');