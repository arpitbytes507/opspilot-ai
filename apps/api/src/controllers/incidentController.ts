import type { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../services/auditService';
import { getPrimaryOrganization } from '../services/organizationContext';
import { HttpError } from '../utils/httpError';
import { incidentIdParamsSchema, incidentListQuerySchema, updateIncidentSchema } from '../validators/incidentValidators';
import { createRootCauseAnalysis, getLatestRootCauseAnalysis } from '../services/ai/aiAnalysisService';

const incidentSelect = {
  id: true, title: true, description: true, status: true, severity: true, detectedAt: true,
  startedAt: true, mitigatedAt: true, resolvedAt: true, createdAt: true, updatedAt: true,
  service: { select: { id: true, name: true } },
  serviceEnvironment: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} as const;

const requestAuditContext = (req: Request) => ({ userId: req.auth?.id, ipAddress: req.ip || req.socket.remoteAddress, userAgent: req.get('user-agent') });

const transitions: Record<string, string[]> = {
  DETECTED: ['OPEN'], OPEN: ['INVESTIGATING'], INVESTIGATING: ['MITIGATED'], MITIGATED: ['RESOLVED'], RESOLVED: ['POSTMORTEM'], POSTMORTEM: [],
};

export const listIncidents = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const query = incidentListQuerySchema.parse(req.query);
  const where = { organizationId: organization.organizationId, ...(query.status ? { status: query.status } : {}), ...(query.severity ? { severity: query.severity } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}), ...(query.environmentId ? { serviceEnvironmentId: query.environmentId } : {}) };
  const orderBy = query.sort === 'oldest' ? { detectedAt: 'asc' as const } : query.sort === 'severity' ? { severity: 'asc' as const } : query.sort === 'updated' ? { updatedAt: 'desc' as const } : { detectedAt: 'desc' as const };
  const [items, total] = await Promise.all([
    prisma.incident.findMany({ where, select: incidentSelect, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.incident.count({ where }),
  ]);
  res.json({ success: true, data: { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } } });
};

export const getIncident = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const { incidentId } = incidentIdParamsSchema.parse(req.params);
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, organizationId: organization.organizationId }, select: incidentSelect });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  res.json({ success: true, data: incident });
};

export const updateIncident = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const { incidentId } = incidentIdParamsSchema.parse(req.params);
  const input = updateIncidentSchema.parse(req.body);
  const current = await prisma.incident.findFirst({ where: { id: incidentId, organizationId: organization.organizationId }, select: { status: true, severity: true, assignedToUserId: true } });
  if (!current) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  if (input.status && input.status !== current.status && !transitions[current.status].includes(input.status)) throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `Cannot move incident from ${current.status} to ${input.status}`);
  if (input.assignedToUserId) {
    const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: organization.organizationId, userId: input.assignedToUserId } } });
    if (!member) throw new HttpError(422, 'INVALID_ASSIGNEE', 'Assignee must belong to the organization');
  }
  const now = new Date();
  const timestamps = input.status === 'OPEN' && current.status === 'DETECTED' ? { startedAt: now } : input.status === 'MITIGATED' ? { mitigatedAt: now } : input.status === 'RESOLVED' ? { resolvedAt: now } : {};
  const incident = await prisma.incident.update({ where: { id: incidentId }, data: { ...input, ...timestamps }, select: incidentSelect });
  await recordAuditLog({ organizationId: organization.organizationId, action: 'INCIDENT_UPDATED', resourceType: 'INCIDENT', resourceId: incidentId, ...requestAuditContext(req), metadata: { changes: input } });
  res.json({ success: true, data: incident });
};

export const listIncidentEvents = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const { incidentId } = incidentIdParamsSchema.parse(req.params);
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, organizationId: organization.organizationId }, select: { id: true } });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const events = await prisma.event.findMany({ where: { incidentEvents: { some: { incidentId } } }, select: { id: true, type: true, level: true, message: true, source: true, timestamp: true, traceId: true, requestId: true, service: { select: { name: true } }, serviceEnvironment: { select: { name: true } } }, orderBy: { timestamp: 'asc' }, take: 500 });
  res.json({ success: true, data: events });
};

export const listIncidentDeployments = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const { incidentId } = incidentIdParamsSchema.parse(req.params);
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, organizationId: organization.organizationId }, select: { serviceId: true, serviceEnvironmentId: true, detectedAt: true } });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const deployments = await prisma.deployment.findMany({ where: { organizationId: organization.organizationId, serviceId: incident.serviceId, serviceEnvironmentId: incident.serviceEnvironmentId, startedAt: { lte: incident.detectedAt } }, select: { id: true, version: true, commitSha: true, status: true, startedAt: true, completedAt: true, deployedBy: { select: { name: true, email: true } } }, orderBy: { startedAt: 'desc' }, take: 20 });
  res.json({ success: true, data: deployments });
};

export const getIncidentRootCause = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const { incidentId } = incidentIdParamsSchema.parse(req.params);
  const analysis = await getLatestRootCauseAnalysis(incidentId, organization.organizationId);
  res.json({ success: true, data: analysis });
};

export const analyzeIncidentRootCause = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const { incidentId } = incidentIdParamsSchema.parse(req.params);
  const analysis = await createRootCauseAnalysis(incidentId, organization.organizationId);
  res.status(201).json({ success: true, data: analysis });
};