import { startEventWorker, stopEventWorker } from './workers/eventWorker';

const worker = startEventWorker();
console.info('OpsPilot event worker started');

const shutdown = async (): Promise<void> => {
  await stopEventWorker(worker);
  process.exit(0);
};

process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
