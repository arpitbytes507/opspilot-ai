import type { OrganizationRole, User } from '@prisma/client';

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'name' | 'avatarUrl' | 'isActive'>;

export type OrganizationMembershipContext = {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
      membership?: OrganizationMembershipContext;
    }
  }
}

export {};
