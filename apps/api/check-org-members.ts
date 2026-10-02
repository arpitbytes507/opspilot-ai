import { prisma } from "./src/lib/prisma";

async function main() {
  const org = await prisma.organization.findUnique({
    where: {
      id: "40b94165-10b6-4363-88bd-2009b5b9ba12",
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!org) {
    console.log("ORGANIZATION_NOT_FOUND");
    return;
  }

  console.log("ORGANIZATION:");
  console.dir(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    { depth: null }
  );

  console.log("\nMEMBERS:");
  console.dir(org.members, { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
