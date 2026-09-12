import type { NextFunction, Request, Response } from 'express';

import { generateRequestId } from '../utils/requestId';

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId = req.get('x-request-id') || generateRequestId();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};
