import type { NextFunction, Request, Response } from 'express';
import type { OrganizationRole } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/httpError';
import { organizationIdSchema } from '../validators/authValidators';

const roleRank: Record<OrganizationRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const requireOrganizationMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const { organizationId } = organizationIdSchema.parse(req.params);

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.auth.id,
        },
      },
      select: { organizationId: true, userId: true, role: true },
    });

    if (!membership) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this organization');
    }

    req.membership = membership;
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export const requireRole = (minimumRole: OrganizationRole) => (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.membership) {
    next(new HttpError(403, 'FORBIDDEN', 'Organization membership is required'));
    return;
  }

  if (roleRank[req.membership.role] < roleRank[minimumRole]) {
    next(new HttpError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    return;
  }

  next();
};

export const requirePrimaryOrganizationMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth.id },
      select: { organizationId: true, userId: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw new HttpError(403, 'FORBIDDEN', 'Organization membership is required');
    req.membership = membership;
    next();
  } catch (error: unknown) {
    next(error);
  }
};
