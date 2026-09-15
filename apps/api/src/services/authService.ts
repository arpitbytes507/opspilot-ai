import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import type { AuthenticatedUser } from '../types/auth';
import { HttpError } from '../utils/httpError';

const tokenLifetime = '1d';

type AuthToken = {
  userId: string;
};

export const toSafeUser = (user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
}): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  isActive: user.isActive,
});

const getAuthSecret = (): string => {
  if (config.authSecret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters long');
  }

  return config.authSecret;
};

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

export const verifyPassword = (password: string, passwordHash: string): Promise<boolean> =>
  bcrypt.compare(password, passwordHash);

export const createAuthToken = (userId: string): string =>
  jwt.sign({ userId } satisfies AuthToken, getAuthSecret(), {
    expiresIn: tokenLifetime,
    subject: userId,
  });

export const verifyAuthToken = (token: string): AuthToken => {
  const payload = jwt.verify(token, getAuthSecret());

  if (typeof payload === 'string' || typeof payload.userId !== 'string') {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  return { userId: payload.userId };
};

export const findActiveUser = async (userId: string): Promise<AuthenticatedUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
    },
  });

  if (!user?.isActive) {
    return null;
  }

  return toSafeUser(user);
};
