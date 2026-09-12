import { randomUUID } from 'node:crypto';

export const generateRequestId = (): string => randomUUID();
