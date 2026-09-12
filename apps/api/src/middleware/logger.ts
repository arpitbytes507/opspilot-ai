import type { NextFunction, Request, Response } from 'express';

export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId = req.get('x-request-id') || 'unknown';
  const timestamp = new Date().toISOString();

  console.info(`${timestamp} [${requestId}] ${req.method} ${req.originalUrl}`);
  next();
};
