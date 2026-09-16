import { Prisma } from '@prisma/client';

import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import type { NormalizedEvent } from '../types/ingestion';

const activeIncidentStatuses = ['DETECTED', 'OPEN', 'INVESTIGATING', 'MITIGATED'] as const;

export const findActiveIncidentForEvent = async (event: NormalizedEvent): Promise<{ id: string } | null> => {
  const correlationWindow = new Date(Date.now() - config.incidentCorrelationWindowSeconds * 1000);

  const byScope = await prisma.incident.findFirst({
    where: {
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      serviceEnvironmentId: event.serviceEnvironmentId,
      status: { in: [...activeIncidentStatuses] },
      detectedAt: { gte: correlationWindow },
    },
    orderBy: { detectedAt: 'desc' },
    select: { id: true },
  });

  if (byScope) return byScope;

  if (event.traceId) {
    const byTrace = await prisma.incident.findFirst({
      where: {
        organizationId: event.organizationId,
        status: { in: [...activeIncidentStatuses] },
        detectedAt: { gte: correlationWindow },
        incidentEvents: { some: { event: { traceId: event.traceId, organizationId: event.organizationId } } },
      },
      select: { id: true },
    });
    if (byTrace) return byTrace;
  }

  if (event.requestId) {
    const byRequest = await prisma.incident.findFirst({
      where: {
        organizationId: event.organizationId,
        status: { in: [...activeIncidentStatuses] },
        detectedAt: { gte: correlationWindow },
        incidentEvents: { some: { event: { requestId: event.requestId, organizationId: event.organizationId } } },
      },
      select: { id: true },
    });
    if (byRequest) return byRequest;
  }

  return null;
};
