import type { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../services/auditService';
import {
  findActiveUser,
  hashPassword,
  toSafeUser,
  verifyPassword,
} from '../services/authService';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import { HttpError } from '../utils/httpError';
import { loginSchema, registerSchema } from '../validators/authValidators';

const slugify = (value: string): string => {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'organization';
};

const requestIp = (req: Request): string | undefined => req.ip || req.socket.remoteAddress;

export const register = async (req: Request, res: Response): Promise<void> => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  const baseSlug = slugify(`${input.name}-organization`);

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }

    const user = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });
    const organization = await tx.organization.create({
      data: {
        name: `${input.name}'s Organization`,
        slug: `${baseSlug}-${user.id.slice(0, 8)}`,
      },
    });
    await tx.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: 'OWNER' },
    });

    return { user, organization };
  });

  await recordAuditLog({
    organizationId: result.organization.id,
    userId: result.user.id,
    action: 'REGISTER',
    resourceType: 'USER',
    resourceId: result.user.id,
    ipAddress: requestIp(req),
    userAgent: req.get('user-agent'),
  });

  setAuthCookie(res, result.user.id);
  res.status(201).json({
    success: true,
    data: {
      user: toSafeUser(result.user),
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        role: 'OWNER',
      },
    },
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const validPassword = user ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !user.isActive || !validPassword) {
    if (user) {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      await Promise.all(memberships.map((membership) => recordAuditLog({
        organizationId: membership.organizationId,
        userId: user.id,
        action: 'LOGIN_FAILURE',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress: requestIp(req),
        userAgent: req.get('user-agent'),
      })));
    }
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  await Promise.all(memberships.map((membership) => recordAuditLog({
    organizationId: membership.organizationId,
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    resourceType: 'USER',
    resourceId: user.id,
    ipAddress: requestIp(req),
    userAgent: req.get('user-agent'),
  })));

  setAuthCookie(res, user.id);
  res.status(200).json({ success: true, data: { user: toSafeUser(user) } });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  if (req.auth) {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.auth.id },
      select: { organizationId: true },
    });
    await Promise.all(memberships.map((membership) => recordAuditLog({
      organizationId: membership.organizationId,
      userId: req.auth?.id,
      action: 'LOGOUT',
      resourceType: 'USER',
      resourceId: req.auth?.id,
      ipAddress: requestIp(req),
      userAgent: req.get('user-agent'),
    })));
  }

  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const currentUser = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: req.auth.id },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json({
    success: true,
    data: {
      user: req.auth,
      organizations: memberships.map(({ role, organization }) => ({ ...organization, role })),
    },
  });
};
