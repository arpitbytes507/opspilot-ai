import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/httpError';

export const getPrimaryOrganization = async (userId: string) => {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true, role: true, organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw new HttpError(404, 'ORGANIZATION_NOT_FOUND', 'No organization is available');
  return membership;
};