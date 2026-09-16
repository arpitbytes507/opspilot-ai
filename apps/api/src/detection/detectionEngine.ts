import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import type { NormalizedEvent } from '../types/ingestion';
import { calculateSeverity, type SeverityRuleName } from './severityCalculator';

export type DetectionResult = {
  detected: boolean;
  rule: SeverityRuleName;
  reason: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  eventIds: string[];
  organizationId: string;
  projectId: string;
  serviceId: string;
  environmentId: string;
  title: string;
  description: string;
};

export type DetectionContext = {
  event: NormalizedEvent;
  environmentName?: string;
};

export type DetectionRule = {
  name: SeverityRuleName;
  evaluate: (context: DetectionContext) => Promise<DetectionResult | null>;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const candidate = Number(value);
    if (Number.isFinite(candidate)) return candidate;
  }
  return null;
};

const asBoolean = (value: unknown): boolean => value === true || value === 'true' || value === 'TRUE';

const getEnvironmentName = async (serviceEnvironmentId: string): Promise<string | undefined> => {
  const environment = await prisma.serviceEnvironment.findUnique({
    where: { id: serviceEnvironmentId },
    select: { name: true },
  });
  return environment?.name;
};

const errorBurstRule: DetectionRule = {
  name: 'ERROR_BURST',
  async evaluate({ event }) {
    if (event.type !== 'ERROR') return null;
    const windowMs = config.errorBurstWindowSeconds * 1000;
    const threshold = config.errorBurstThreshold;
    if (threshold <= 0) return null;

    const cutoff = new Date(Date.now() - windowMs);
    const where = {
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      serviceEnvironmentId: event.serviceEnvironmentId,
      type: 'ERROR' as const,
      timestamp: { gte: cutoff },
    } satisfies Prisma.EventWhereInput;

    const [count, recentEvents] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        select: { id: true },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    if (count < threshold) return null;
    const environmentName = await getEnvironmentName(event.serviceEnvironmentId);
    const severity = calculateSeverity({ rule: 'ERROR_BURST', eventCount: count, environmentName });
    const title = `Error spike detected in service ${event.serviceId}`;
    const description = `${count} ERROR events were detected within ${config.errorBurstWindowSeconds} seconds in ${environmentName ?? 'the configured environment'}.`;

    return {
      detected: true,
      rule: 'ERROR_BURST',
      reason: `${count} ERROR events detected for the same service and environment within ${config.errorBurstWindowSeconds} seconds`,
      severity,
      eventIds: recentEvents.map((item) => item.id),
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      environmentId: event.serviceEnvironmentId,
      title,
      description,
    };
  },
};

const highSeveritySingleErrorRule: DetectionRule = {
  name: 'HIGH_SEVERITY_SINGLE_ERROR',
  async evaluate({ event }) {
    if (event.type !== 'ERROR') return null;

    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const supportedFatal = asBoolean(metadata.fatal) || asBoolean(metadata.critical);
    const severity = typeof metadata.severity === 'string' ? metadata.severity.toLowerCase() : '';
    const errorCode = typeof metadata.errorCode === 'string' ? metadata.errorCode.toLowerCase() : '';
    const fatalSignal = supportedFatal || severity === 'fatal' || severity === 'critical' || errorCode.includes('fatal') || errorCode.includes('critical');

    if (!fatalSignal) return null;

    const environmentName = await getEnvironmentName(event.serviceEnvironmentId);

    return {
      detected: true,
      rule: 'HIGH_SEVERITY_SINGLE_ERROR',
      reason: 'Fatal or critical error signal detected in structured metadata',
      severity: calculateSeverity({ rule: 'HIGH_SEVERITY_SINGLE_ERROR', environmentName }),
      eventIds: [event.id],
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      environmentId: event.serviceEnvironmentId,
      title: `Critical error detected in service ${event.serviceId}`,
      description: 'A fatal or critical structured error signal was detected.',
    };
  },
};

const performanceDegradationRule: DetectionRule = {
  name: 'PERFORMANCE_DEGRADATION',
  async evaluate({ event }) {
    if (event.type !== 'PERFORMANCE') return null;
    const durationMs = toNumber(event.metadata?.durationMs ?? event.metadata?.latencyMs ?? event.metadata?.duration ?? event.metadata?.value);
    if (durationMs === null) return null;
    if (durationMs < config.performanceLatencyThresholdMs) return null;

    const cutoff = new Date(Date.now() - config.errorBurstWindowSeconds * 1000);
    const where = {
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      serviceEnvironmentId: event.serviceEnvironmentId,
      type: 'PERFORMANCE' as const,
      timestamp: { gte: cutoff },
    } satisfies Prisma.EventWhereInput;

    const matches = await prisma.event.findMany({
      where,
      select: { id: true, metadata: true },
      orderBy: { timestamp: 'asc' },
    });

    const qualifying = matches.filter((item) => {
      const value = toNumber((item.metadata as Record<string, unknown> | null)?.durationMs ?? (item.metadata as Record<string, unknown> | null)?.latencyMs);
      return value !== null && value >= config.performanceLatencyThresholdMs;
    });

    if (qualifying.length < config.performanceDegradationThreshold) return null;

    const environmentName = await getEnvironmentName(event.serviceEnvironmentId);

    return {
      detected: true,
      rule: 'PERFORMANCE_DEGRADATION',
      reason: `${qualifying.length} performance events exceeded ${config.performanceLatencyThresholdMs}ms within ${config.errorBurstWindowSeconds} seconds`,
      severity: calculateSeverity({ rule: 'PERFORMANCE_DEGRADATION', eventCount: qualifying.length, environmentName }),
      eventIds: qualifying.map((item) => item.id),
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      environmentId: event.serviceEnvironmentId,
      title: `Performance degradation detected in service ${event.serviceId}`,
      description: `${qualifying.length} performance events exceeded ${config.performanceLatencyThresholdMs}ms in the configured window.`,
    };
  },
};

const deploymentFailureRule: DetectionRule = {
  name: 'DEPLOYMENT_FAILURE',
  async evaluate({ event }) {
    if (event.type !== 'DEPLOYMENT') return null;

    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const status = String((metadata.status ?? payload.status ?? metadata.state ?? payload.state ?? '')).toLowerCase();
    const deploymentStatus = String((metadata.deploymentStatus ?? payload.deploymentStatus ?? '')).toLowerCase();
    const failed = status.includes('failed') || deploymentStatus.includes('failed') || status === 'failure' || status === 'failed' || deploymentStatus === 'failure' || deploymentStatus === 'failed';

    if (!failed) return null;

    const environmentName = await getEnvironmentName(event.serviceEnvironmentId);

    return {
      detected: true,
      rule: 'DEPLOYMENT_FAILURE',
      reason: 'Deployment event reported a failed status',
      severity: calculateSeverity({ rule: 'DEPLOYMENT_FAILURE', environmentName }),
      eventIds: [event.id],
      organizationId: event.organizationId,
      projectId: event.projectId,
      serviceId: event.serviceId,
      environmentId: event.serviceEnvironmentId,
      title: `Deployment failure detected in service ${event.serviceId}`,
      description: 'A deployment event reported a failed status for the service environment.',
    };
  },
};

const rules: DetectionRule[] = [
  highSeveritySingleErrorRule,
  errorBurstRule,
  performanceDegradationRule,
  deploymentFailureRule,
];

export const evaluateDetectionRules = async (event: NormalizedEvent): Promise<DetectionResult | null> => {
  const environmentName = await getEnvironmentName(event.serviceEnvironmentId);
  for (const rule of rules) {
    const result = await rule.evaluate({ event, environmentName });
    if (result) return result;
  }
  return null;
};
