import { z } from 'zod';

const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and single hyphens');
const name = z.string().trim().min(1).max(120);
const description = z.string().trim().max(500).optional().nullable();

export const projectIdParamsSchema = z.object({ organizationId: z.string().uuid(), projectId: z.string().uuid() });
export const serviceIdParamsSchema = projectIdParamsSchema.extend({ serviceId: z.string().uuid() });
export const environmentIdParamsSchema = serviceIdParamsSchema.extend({ environmentId: z.string().uuid() });
export const apiKeyIdParamsSchema = environmentIdParamsSchema.extend({ apiKeyId: z.string().uuid() });

export const createProjectSchema = z.object({ name, slug, description });
export const updateProjectSchema = z.object({ name: name.optional(), slug: slug.optional(), description }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const createServiceSchema = z.object({ name, slug, description });
export const updateServiceSchema = updateProjectSchema;
export const createEnvironmentSchema = z.object({ name });
export const updateEnvironmentSchema = z.object({ name }).strict();
export const createApiKeySchema = z.object({
  name,
  expiresAt: z.string().datetime({ offset: true }).optional(),
});
