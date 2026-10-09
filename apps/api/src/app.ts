import cors from 'cors';
import express from 'express';

import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { loggerMiddleware } from './middleware/logger';
import { requestIdMiddleware } from './middleware/requestId';
import apiRouter from './routes';
import eventRoutes from './routes/eventRoutes';

const app = express();

const allowedOrigins = new Set([
  'https://opspilot-ai-eta.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  config.webOrigin.replace(/\/$/, ''),
]);

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '');

    if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    console.error('[CORS] Rejected origin:', JSON.stringify(origin));
    console.error('[CORS] Allowed origins:', [...allowedOrigins]);

    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(requestIdMiddleware);
app.use(loggerMiddleware);

app.use('/api/v1/events', express.json({ limit: config.ingestBodyLimit }), eventRoutes);
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'opspilot-api',
  });
});

app.use('/api/v1', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
