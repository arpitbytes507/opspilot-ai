import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ERROR_BURST_THRESHOLD = '3';
process.env.ERROR_BURST_WINDOW_SECONDS = '300';
process.env.INCIDENT_CORRELATION_WINDOW_SECONDS = '900';
process.env.PERFORMANCE_LATENCY_THRESHOLD_MS = '2000';
process.env.PERFORMANCE_DEGRADATION_THRESHOLD = '2';

const { prisma } = await import('../src/lib/prisma');
const { processEvent } = await import('../src/workers/eventWorker');

const makeSlug = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const createTenant = async (suffix: string) => {
  const org = await prisma.organization.create({
    data: {
      name: `Org ${suffix}`,
      slug: makeSlug(`org-${suffix}`),
    },
  });

  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: `Project ${suffix}`,
      slug: makeSlug(`project-${suffix}`),
      description: 'test',
    },
  });

  const service = await prisma.service.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      name: `Service ${suffix}`,
      slug: makeSlug(`service-${suffix}`),
      description: 'test',
    },
  });

  const environment = await prisma.serviceEnvironment.create({
    data: {
      organizationId: org.id,
      serviceId: service.id,
      name: 'production',
    },
  });

  return { org, project, service, environment };
};

describe('event worker persistence and incident detection', () => {
  beforeEach(async () => {
    await prisma.incidentEvent.deleteMany({});
    await prisma.incident.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.apiKey.deleteMany({});
    await prisma.deployment.deleteMany({});
    await prisma.serviceEnvironment.deleteMany({});
    await prisma.service.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  it('persists worker events before invoking production error-burst detection', { timeout: 60000 }, async () => {
    const tenant = await createTenant('burst');

    for (let index = 0; index < 10; index += 1) {
      await processEvent({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        organizationId: tenant.org.id,
        projectId: tenant.project.id,
        serviceId: tenant.service.id,
        serviceEnvironmentId: tenant.environment.id,
        apiKeyId: '00000000-0000-4000-8000-000000000001',
        type: 'ERROR',
        level: 'ERROR',
        message: `worker error ${index}`,
        source: 'test',
        timestamp: new Date(Date.now() - 1000 * (9 - index)).toISOString(),
      });
    }

    const incidents = await prisma.incident.findMany({
      where: { organizationId: tenant.org.id, serviceId: tenant.service.id },
    });

    expect(incidents.length).toBeGreaterThanOrEqual(1);
    expect(incidents[0]?.severity).toBe('P2');
    const persistedEvents = await prisma.event.count({ where: { organizationId: tenant.org.id, serviceId: tenant.service.id } });
    expect(persistedEvents).toBe(10);
    const links = await prisma.incidentEvent.count({
      where: { incidentId: incidents[0].id },
    });
    expect(links).toBeGreaterThanOrEqual(1);
  });

  it('correlates later matching events to the same open incident', { timeout: 30000 }, async () => {
    const tenant = await createTenant('correlate');

    for (let index = 0; index < 3; index += 1) {
      await processEvent({
        id: `00000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
        organizationId: tenant.org.id,
        projectId: tenant.project.id,
        serviceId: tenant.service.id,
        serviceEnvironmentId: tenant.environment.id,
        apiKeyId: '00000000-0000-4000-8000-000000000001',
        type: 'ERROR',
        level: 'ERROR',
        message: `network failure ${index}`,
        source: 'test',
        timestamp: new Date(Date.now() - 1000 * (2 - index)).toISOString(),
      });
    }

    const initialIncidents = await prisma.incident.findMany({
      where: { organizationId: tenant.org.id, serviceId: tenant.service.id },
      orderBy: { detectedAt: 'asc' },
    });

    expect(initialIncidents.length).toBe(1);

    await processEvent({
      id: '00000000-0000-4000-8000-000000000200',
      organizationId: tenant.org.id,
      projectId: tenant.project.id,
      serviceId: tenant.service.id,
      serviceEnvironmentId: tenant.environment.id,
      apiKeyId: '00000000-0000-4000-8000-000000000001',
      type: 'ERROR',
      level: 'ERROR',
      message: 'follow-up error',
      source: 'test',
      timestamp: new Date().toISOString(),
    });

    const incidents = await prisma.incident.findMany({
      where: { organizationId: tenant.org.id, serviceId: tenant.service.id },
      orderBy: { detectedAt: 'asc' },
    });

    expect(incidents.length).toBe(1);
    const incident = incidents[0];
    const links = await prisma.incidentEvent.count({ where: { incidentId: incident!.id } });
    expect(links).toBeGreaterThanOrEqual(4);
  });
});
