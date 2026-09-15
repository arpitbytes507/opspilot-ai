import cors from 'cors';
import express from 'express';

import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { loggerMiddleware } from './middleware/logger';
import { requestIdMiddleware } from './middleware/requestId';
import apiRouter from './routes';
import eventRoutes from './routes/eventRoutes';

const app = express();

app.use(cors({ origin: config.webOrigin, credentials: true }));
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
