import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import type { ApiResponse } from '../types/http';
import { HttpError } from '../utils/httpError';

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
  const bodyParserError = err as Error & { type?: string };
  const statusCode = err instanceof HttpError ? err.statusCode : err instanceof ZodError ? 400 : bodyParserError.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
  const code = err instanceof HttpError ? err.code : err instanceof ZodError ? 'VALIDATION_ERROR' : bodyParserError.type === 'entity.too.large' ? 'REQUEST_TOO_LARGE' : err instanceof SyntaxError ? 'INVALID_JSON' : 'INTERNAL_SERVER_ERROR';

  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
  };

  console.error(`${new Date().toISOString()} [${requestId}] ${err.message}`);
  res.status(statusCode).set('X-Request-ID', requestId).json(payload);
};
