import type { NextFunction, Request, Response } from 'express';

import type { ApiResponse } from '../types/http';

export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.get('x-request-id') || 'unknown';

  const payload: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  };

  res.status(404).set('X-Request-ID', requestId).json(payload);
};

export const errorHandler = (
  err: Error & { statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = req.get('x-request-id') || 'unknown';
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;

  const payload: ApiResponse = {
    success: false,
    error: {
      code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
  };

  console.error(`${new Date().toISOString()} [${requestId}] ${err.message}`);
  res.status(statusCode).set('X-Request-ID', requestId).json(payload);
};
