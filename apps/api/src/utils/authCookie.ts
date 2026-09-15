import { serialize } from 'cookie';
import type { Response } from 'express';

import { config } from '../config/env';
import { createAuthToken } from '../services/authService';

const maxAgeSeconds = 60 * 60 * 24;

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeSeconds,
};

export const setAuthCookie = (res: Response, userId: string): void => {
  res.setHeader('Set-Cookie', serialize(config.authCookieName, createAuthToken(userId), cookieOptions));
};

export const clearAuthCookie = (res: Response): void => {
  res.setHeader(
    'Set-Cookie',
    serialize(config.authCookieName, '', { ...cookieOptions, maxAge: 0 }),
  );
};
