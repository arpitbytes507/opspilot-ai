import app from './app';
import { config } from './config/env';
import { closeRedis } from './lib/redis';
import { closeEventQueue } from './queues/eventQueue';
import { prisma } from './lib/prisma';

const server = app.listen(config.port, () => {
  console.info(`OpsPilot API listening on http://localhost:${config.port}`);
});

const shutdown = async (): Promise<void> => {
  server.close(async () => {
    await closeEventQueue();
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
