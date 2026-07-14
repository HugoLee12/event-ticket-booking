import express, { NextFunction, Request, Response } from 'express';
import { requireAuth } from './auth';
import { bookingsRouter } from './bookings';
import { eventsRouter } from './events';
import { logger } from './logger';
import { counters, metricsRouter } from './metrics';

export const app = express();
app.use(express.json());

app.use((_req, _res, next) => {
  counters.totalRequests++;
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'booking' });
});

app.use('/api/v1/events', requireAuth, eventsRouter);
app.use('/api/v1/bookings', requireAuth, bookingsRouter);
app.use('/api/v1/metrics', requireAuth, metricsRouter);

// Express 5 tự chuyển rejection của async handler xuống đây.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'lỗi hệ thống chưa bắt');
  res.status(500).json({ error: 'Lỗi hệ thống' });
});
