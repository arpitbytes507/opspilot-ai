import { prisma } from '../lib/prisma';
import { evaluateDetectionRules } from '../detection/detectionEngine';
import type { DetectionResult } from '../detection/detectionEngine';
import { findActiveIncidentForEvent } from '../detection/incidentCorrelator';
import type { NormalizedEvent } from '../types/ingestion';
import { correlateEventToIncident, createIncidentFromDetection } from './incidentService';

export const evaluateEventForIncidentDetection = async (event: NormalizedEvent): Promise<(DetectionResult & { incidentId?: string; created?: boolean }) | null> => {
  const existingIncident = await findActiveIncidentForEvent(event);
  if (existingIncident) {
    await correlateEventToIncident(event);
    return null;
  }

  const detection = await evaluateDetectionRules(event);
  if (!detection) return null;

  const service = await prisma.service.findUnique({
    where: { id: event.serviceId },
    select: { name: true },
  });

  const environment = await prisma.serviceEnvironment.findUnique({
    where: { id: event.serviceEnvironmentId },
    select: { name: true },
  });

  const finalTitle = detection.title.includes('service')
    ? detection.title.replace('service', service?.name ?? 'service')
    : detection.title;

  const finalDescription = detection.description.includes('configured environment')
    ? detection.description.replace('configured environment', environment?.name ?? 'the configured environment')
    : detection.description;

  const normalized = {
    ...detection,
    title: finalTitle,
    description: finalDescription,
  };

  const incident = await createIncidentFromDetection(event, normalized);
  return { ...normalized, incidentId: incident.incidentId, created: incident.created };
};
