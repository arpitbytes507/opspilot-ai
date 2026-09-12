import type { Request, Response } from 'express';

import type { ApiResponse } from '../types/http';

export const getHealth = (_req: Request, res: Response): void => {
  const payload: ApiResponse<{ status: string; service: string }> = {
    success: true,
    data: {
      status: 'ok',
      service: 'opspilot-api',
    },
  };

  res.status(200).json(payload);
};
