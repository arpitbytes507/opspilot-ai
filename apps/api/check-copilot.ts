import { prisma } from "./src/lib/prisma";

async function main() {
  const conversations = await prisma.aIConversation.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  console.dir(conversations, { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
