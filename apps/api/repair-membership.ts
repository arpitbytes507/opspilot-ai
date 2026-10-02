import { prisma } from "./src/lib/prisma";

async function main() {
  const email = "arpit@gmail.com";
  const organizationId = "40b94165-10b6-4363-88bd-2009b5b9ba12";

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
  });

  if (existing) {
    console.log("MEMBERSHIP_ALREADY_EXISTS");
    console.log({
      userId: user.id,
      organizationId,
      role: existing.role,
    });
    return;
  }

  const membership = await prisma.organizationMember.create({
    data: {
      organizationId,
      userId: user.id,
      role: "OWNER",
    },
  });

  console.log("MEMBERSHIP_CREATED");
  console.log({
    membershipId: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    role: membership.role,
  });
}

main()
  .catch((error) => {
    console.error("REPAIR_FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
