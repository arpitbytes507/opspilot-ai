import type { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../services/auditService';
import { HttpError } from '../utils/httpError';
import { memberUserIdSchema, organizationIdSchema, updateMemberRoleSchema } from '../validators/authValidators';

export const listOrganizations = async (req: Request, res: Response): Promise<void> => {
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
    data: memberships.map(({ role, organization }) => ({ ...organization, role })),
  });
};

export const getOrganization = async (req: Request, res: Response): Promise<void> => {
  const { organizationId } = organizationIdSchema.parse(req.params);
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
  });

  if (!organization) {
    throw new HttpError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
  }

  res.status(200).json({ success: true, data: organization });
};

export const listMembers = async (req: Request, res: Response): Promise<void> => {
  const { organizationId } = organizationIdSchema.parse(req.params);
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json({ success: true, data: members });
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  const { organizationId, userId } = memberUserIdSchema.parse(req.params);
  const { role } = updateMemberRoleSchema.parse(req.body);
  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (!target) {
    throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Organization member not found');
  }

  if (target.role === 'OWNER' && role !== 'OWNER') {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw new HttpError(409, 'LAST_OWNER', 'The organization must retain at least one owner');
    }
  }

  const membership = await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId, userId } },
    data: { role },
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
    },
  });

  await recordAuditLog({
    organizationId,
    userId: req.auth?.id,
    action: 'MEMBER_ROLE_UPDATED',
    resourceType: 'ORGANIZATION_MEMBER',
    resourceId: userId,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    metadata: { previousRole: target.role, role },
  });

  res.status(200).json({ success: true, data: membership });
};
