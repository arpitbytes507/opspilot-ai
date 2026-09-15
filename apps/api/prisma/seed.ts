import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'dev@example.local' },
    update: {},
    create: {
      email: 'dev@example.local',
      name: 'Development User',
      passwordHash: 'DEVELOPMENT_ONLY_NO_AUTH_PASSWORD',
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'development-org' },
    update: {},
    create: { name: 'Development Organization', slug: 'development-org' },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
    update: { role: 'OWNER' },
    create: { organizationId: organization.id, userId: user.id, role: 'OWNER' },
  });

  const project = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: 'development-project' } },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Development Project',
      slug: 'development-project',
      description: 'Local development dataset only',
    },
  });

  const service = await prisma.service.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'development-api' } },
    update: {},
    create: {
      organizationId: organization.id,
      projectId: project.id,
      name: 'Development API',
      slug: 'development-api',
    },
  });

  const environment = await prisma.serviceEnvironment.upsert({
    where: { serviceId_name: { serviceId: service.id, name: 'development' } },
    update: {},
    create: { organizationId: organization.id, serviceId: service.id, name: 'development' },
  });

  const firstEvent = await prisma.event.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      serviceId: service.id,
      serviceEnvironmentId: environment.id,
      type: 'ERROR',
      level: 'ERROR',
      message: 'Development database connection test event',
      source: 'development-seed',
      timestamp: new Date('2026-01-01T12:00:00.000Z'),
      metadata: { developmentOnly: true },
      payload: { statusCode: 503 },
    },
  });

  const secondEvent = await prisma.event.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      serviceId: service.id,
      serviceEnvironmentId: environment.id,
      type: 'INFO',
      level: 'INFO',
      message: 'Development service started',
      source: 'development-seed',
      timestamp: new Date('2026-01-01T11:59:00.000Z'),
      metadata: { developmentOnly: true },
    },
  });

  const incident = await prisma.incident.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      serviceId: service.id,
      serviceEnvironmentId: environment.id,
      title: 'Development seed incident',
      description: 'Sample incident for local development only',
      status: 'RESOLVED',
      severity: 'P3',
      detectedAt: new Date('2026-01-01T12:00:00.000Z'),
      resolvedAt: new Date('2026-01-01T12:05:00.000Z'),
      assignedToUserId: user.id,
    },
  });

  await prisma.incidentEvent.createMany({
    data: [
      { incidentId: incident.id, eventId: firstEvent.id },
      { incidentId: incident.id, eventId: secondEvent.id },
    ],
    skipDuplicates: true,
  });

  await prisma.deployment.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      serviceId: service.id,
      serviceEnvironmentId: environment.id,
      version: 'development-seed',
      commitSha: 'development-only',
      status: 'SUCCESS',
      deployedByUserId: user.id,
      startedAt: new Date('2026-01-01T11:50:00.000Z'),
      completedAt: new Date('2026-01-01T11:51:00.000Z'),
      metadata: { developmentOnly: true },
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });