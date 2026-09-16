import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type { NormalizedEvent } from '../types/ingestion';
import type { DetectionResult } from '../detection/detectionEngine';
import { findActiveIncidentForEvent } from '../detection/incidentCorrelator';

export const attachEventToIncident = async (incidentId: string, eventId: string): Promise<void> => {
  try {
    await prisma.incidentEvent.upsert({
      where: {
        incidentId_eventId: {
          incidentId,
          eventId,
        },
      },
      update: {},
      create: {
        incidentId,
        eventId,
      },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === 'P2003' || prismaError?.code === 'P2025') {
      return;
    }
    throw error;
  }
};

export const createIncidentFromDetection = async (event: NormalizedEvent, detection: DetectionResult): Promise<{ created: boolean; incidentId: string }> => {
  const alreadyLinked = await prisma.incidentEvent.findFirst({
    where: { eventId: event.id },
    select: { incidentId: true },
  });

  if (alreadyLinked) {
    return { created: false, incidentId: alreadyLinked.incidentId };
  }

  const existingIncident = await findActiveIncidentForEvent(event);

  if (existingIncident) {
    await attachEventToIncident(existingIncident.id, event.id);
    return { created: false, incidentId: existingIncident.id };
  }

  const incident = await prisma.incident.create({
    data: {
      organizationId: detection.organizationId,
      projectId: detection.projectId,
      serviceId: detection.serviceId,
      serviceEnvironmentId: detection.environmentId,
      title: detection.title,
      description: detection.description,
      status: 'DETECTED',
      severity: detection.severity,
      detectedAt: new Date(),
      startedAt: new Date(),
    },
  });

  const uniqueEventIds = [...new Set(detection.eventIds.filter((eventId) => Boolean(eventId)))];
  for (const eventId of uniqueEventIds) {
    await attachEventToIncident(incident.id, eventId);
  }

  return { created: true, incidentId: incident.id };
};

export const correlateEventToIncident = async (event: NormalizedEvent): Promise<{ incidentId: string | null; created: boolean }> => {
  const alreadyLinked = await prisma.incidentEvent.findFirst({
    where: { eventId: event.id },
    select: { incidentId: true },
  });
  if (alreadyLinked) return { incidentId: alreadyLinked.incidentId, created: false };

  const existingIncident = await findActiveIncidentForEvent(event);
  if (!existingIncident) return { incidentId: null, created: false };

  await attachEventToIncident(existingIncident.id, event.id);
  return { incidentId: existingIncident.id, created: false };
};
