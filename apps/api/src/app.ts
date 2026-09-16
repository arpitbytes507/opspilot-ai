import cors from 'cors';
import express from 'express';

import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { loggerMiddleware } from './middleware/logger';
import { requestIdMiddleware } from './middleware/requestId';
import apiRouter from './routes';
import eventRoutes from './routes/eventRoutes';

const app = express();

const allowedOrigins = new Set([config.webOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
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
