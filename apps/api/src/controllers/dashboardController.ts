import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getPrimaryOrganization } from '../services/organizationContext';

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  const organization = await getPrimaryOrganization(req.auth!.id);
  const where = { organizationId: organization.organizationId };
  const [counts, recentIncidents, recentEvents, serviceHealth] = await Promise.all([
    prisma.incident.groupBy({ by: ['status', 'severity'], where, _count: { _all: true } }),
    prisma.incident.findMany({ where, select: { id: true, title: true, status: true, severity: true, detectedAt: true, service: { select: { name: true } }, serviceEnvironment: { select: { name: true } }, assignedTo: { select: { name: true } } }, orderBy: { detectedAt: 'desc' }, take: 8 }),
    prisma.event.findMany({ where, select: { id: true, type: true, level: true, message: true, timestamp: true, service: { select: { name: true } }, serviceEnvironment: { select: { name: true } } }, orderBy: { timestamp: 'desc' }, take: 10 }),
    prisma.service.findMany({ where: { organizationId: organization.organizationId }, select: { id: true, name: true, environments: { select: { id: true, name: true, _count: { select: { events: true, incidents: true } }, incidents: { where: { status: { not: 'RESOLVED' } }, select: { id: true, title: true, severity: true }, orderBy: { detectedAt: 'desc' }, take: 1 } } } } }),
  ]);
  const bySeverity = (severity: string) => counts.filter((row) => row.severity === severity).reduce((sum, row) => sum + row._count._all, 0);
  const summary = { activeIncidents: counts.filter((row) => row.status !== 'RESOLVED' && row.status !== 'POSTMORTEM').reduce((sum, row) => sum + row._count._all, 0), p1Incidents: bySeverity('P1'), p2Incidents: bySeverity('P2'), p3Incidents: bySeverity('P3'), resolvedIncidents: counts.filter((row) => row.status === 'RESOLVED' || row.status === 'POSTMORTEM').reduce((sum, row) => sum + row._count._all, 0) };
  res.json({ success: true, data: { organization: organization.organization, summary, recentIncidents, recentEvents, serviceHealth } });
};