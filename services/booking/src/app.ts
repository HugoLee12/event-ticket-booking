import express, { NextFunction, Request, Response } from 'express';
import { requireAuth } from './auth';
import { eventsRouter } from './events';

export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'booking' });
});

app.use('/api/v1/events', requireAuth, eventsRouter);

// Express 5 tự chuyển rejection của async handler xuống đây.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
});
