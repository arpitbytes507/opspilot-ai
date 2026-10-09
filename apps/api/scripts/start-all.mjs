import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shutdownTimeoutMs = 10_000;
const children = [
  spawn(process.execPath, [resolve(apiDirectory, 'dist/server.js')], { cwd: apiDirectory, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(apiDirectory, 'dist/worker.js')], { cwd: apiDirectory, stdio: 'inherit' }),
];

let stopping = false;
let exitCode = 0;
let shutdownTimer;
let closedChildren = 0;

const signalChildren = (signal) => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
};

const beginShutdown = (code, signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  signalChildren(signal);
  shutdownTimer = setTimeout(() => signalChildren('SIGKILL'), shutdownTimeoutMs);
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => beginShutdown(0, signal));
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`Failed to start child process: ${error.message}`);
    beginShutdown(1);
  });

  child.on('close', (code, signal) => {
    closedChildren += 1;
    if (!stopping) {
      console.error(`Child process exited unexpectedly (code=${code}, signal=${signal})`);
      beginShutdown(1);
    }

    if (closedChildren === children.length) {
      clearTimeout(shutdownTimer);
      process.exitCode = exitCode;
    }
  });
}