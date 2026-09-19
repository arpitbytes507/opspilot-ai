import { prisma } from '../src/lib/prisma';

const email = process.argv[2] || 'arpit@gmail.com';

const run = async (): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      organizationMemberships: {
        select: { organizationId: true, role: true, organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    console.log(JSON.stringify({ email, user: null }, null, 2));
    return;
  }

  console.log(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, isActive: user.isActive }, memberships: user.organizationMemberships }, null, 2));
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Organization diagnostic failed');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});