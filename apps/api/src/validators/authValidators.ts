import { z } from 'zod';

const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  email,
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const organizationIdSchema = z.object({
  organizationId: z.string().uuid(),
});

export const memberUserIdSchema = organizationIdSchema.extend({
  userId: z.string().uuid(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});
