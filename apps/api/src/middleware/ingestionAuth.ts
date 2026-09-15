import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import type { IngestionContext } from '../types/ingestion';
import { HttpError } from '../utils/httpError';

const invalidCredentials = (): never => {
  throw new HttpError(401, 'INVALID_INGESTION_CREDENTIALS', 'Invalid ingestion credentials');
};

export const requireIngestionAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer (opspk_[A-Za-z0-9_-]+)$/);
    if (!match) return invalidCredentials();

    const keyHash = createHash('sha256').update(match[1]).digest('hex');
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
        organizationId: true,
        serviceEnvironment: {
          select: {
            id: true,
            organizationId: true,
            serviceId: true,
            service: { select: { projectId: true, organizationId: true, project: { select: { organizationId: true } } } },
          },
        },
      },
    });

    if (!apiKey) return invalidCredentials();
    if (apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt <= new Date())) return invalidCredentials();
    if (
      apiKey.organizationId !== apiKey.serviceEnvironment.organizationId
      || apiKey.organizationId !== apiKey.serviceEnvironment.service.organizationId
      || apiKey.organizationId !== apiKey.serviceEnvironment.service.project.organizationId
    ) return invalidCredentials();

    const context: IngestionContext = {
      apiKeyId: apiKey.id,
      organizationId: apiKey.organizationId,
      projectId: apiKey.serviceEnvironment.service.projectId,
      serviceId: apiKey.serviceEnvironment.serviceId,
      environmentId: apiKey.serviceEnvironment.id,
    };
    req.ingestionContext = context;
    next();
  } catch (error: unknown) {
    next(error);
  }
};
