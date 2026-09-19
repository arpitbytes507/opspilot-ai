import { prisma } from '../../lib/prisma';

const MAX_EVENTS = 50;
const MAX_HISTORY = 20;
const MAX_DEPLOYMENTS = 10;
const CONTEXT_WINDOW_MS = 24 * 60 * 60 * 1000;
const secretPattern = /(password|passwd|secret|token|authorization|cookie|api[-_]?key|jwt|credential|connection[-_]?string)/i;

const sanitizeValue = (value: unknown, key = ''): unknown => {
  if (secretPattern.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    return value.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]').replace(/(?:postgres(?:ql)?|redis):\/\/[^\s]+/gi, '[REDACTED_CONNECTION_STRING]').replace(/\b(?:eyJ|sk-)[A-Za-z0-9._~-]+\b/g, '[REDACTED_TOKEN]').slice(0, 4000);
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)]));
  return value;
};

export const sanitizeAIContext = <T>(value: T): T => sanitizeValue(value) as T;

export const buildIncidentContext = async (incidentId: string, organizationId: string) => {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId },
    select: { id: true, title: true, description: true, severity: true, status: true, detectedAt: true, startedAt: true, service: { select: { id: true, name: true } }, serviceEnvironment: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
  });
  if (!incident) return null;
  const windowStart = new Date(incident.detectedAt.getTime() - CONTEXT_WINDOW_MS);
  const [linkedEvents, precedingEvents, deployments, history] = await Promise.all([
    prisma.event.findMany({ where: { organizationId, incidentEvents: { some: { incidentId } } }, select: { id: true, type: true, level: true, message: true, source: true, timestamp: true, traceId: true, requestId: true, metadata: true }, orderBy: { timestamp: 'desc' }, take: MAX_EVENTS }),
    prisma.event.findMany({ where: { organizationId, serviceId: incident.service.id, serviceEnvironmentId: incident.serviceEnvironment.id, timestamp: { gte: windowStart, lte: incident.detectedAt } }, select: { id: true, type: true, level: true, message: true, source: true, timestamp: true, traceId: true, requestId: true, metadata: true }, orderBy: { timestamp: 'desc' }, take: MAX_EVENTS }),
    prisma.deployment.findMany({ where: { organizationId, serviceId: incident.service.id, serviceEnvironmentId: incident.serviceEnvironment.id, startedAt: { gte: windowStart, lte: incident.detectedAt } }, select: { id: true, version: true, commitSha: true, status: true, startedAt: true, completedAt: true, deployedBy: { select: { name: true } } }, orderBy: { startedAt: 'desc' }, take: MAX_DEPLOYMENTS }),
    prisma.incident.findMany({ where: { organizationId, serviceId: incident.service.id, id: { not: incidentId }, detectedAt: { gte: windowStart } }, select: { id: true, title: true, severity: true, status: true, detectedAt: true, rootCause: true }, orderBy: { detectedAt: 'desc' }, take: MAX_HISTORY }),
  ]);
  const events = new Map([...linkedEvents, ...precedingEvents].map((event) => [event.id, event]));
  return sanitizeAIContext({ incident, events: [...events.values()].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime()).slice(0, MAX_EVENTS), deployments, history });
};