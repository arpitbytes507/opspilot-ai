import type { NextFunction, Request, Response } from 'express';
import { parse } from 'cookie';

import { config } from '../config/env';
import { findActiveUser, verifyAuthToken } from '../services/authService';
import { HttpError } from '../utils/httpError';

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.headers.cookie ? parse(req.headers.cookie)[config.authCookieName] : undefined;

    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const { userId } = verifyAuthToken(token);
    const user = await findActiveUser(userId);

    if (!user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    req.auth = user;
    next();
  } catch (error: unknown) {
    next(error);
  }
};
