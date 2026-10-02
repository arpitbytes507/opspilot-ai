import { prisma } from "./src/lib/prisma";

async function main() {
  const organizationId = "40b94165-10b6-4363-88bd-2009b5b9ba12";

  const [projects, services, environments, events, incidents] =
    await Promise.all([
      prisma.project.count({ where: { organizationId } }),
      prisma.service.count({ where: { organizationId } }),
      prisma.serviceEnvironment.count({ where: { organizationId } }),
      prisma.event.count({ where: { organizationId } }),
      prisma.incident.count({ where: { organizationId } }),
    ]);

  console.log({
    projects,
    services,
    environments,
    events,
    incidents,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
