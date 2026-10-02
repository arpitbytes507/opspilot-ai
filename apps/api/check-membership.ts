import { prisma } from "./src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: {
      email: "arpit@gmail.com",
    },
    include: {
      organizationMemberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    console.log("USER_NOT_FOUND");
    return;
  }

  console.log("USER:");
  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  console.log("\nMEMBERSHIPS:");

  for (const membership of user.organizationMemberships) {
    console.log({
      membershipId: membership.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
