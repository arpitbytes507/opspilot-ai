import type { NextFunction, Request, Response } from 'express';

export const notFoundMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`) as Error & { statusCode?: number };
  error.statusCode = 404;
  next(error);
};
