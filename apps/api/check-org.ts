import { prisma } from "./src/lib/prisma";

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  console.log("ORGANIZATIONS:");
  console.dir(orgs, { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
