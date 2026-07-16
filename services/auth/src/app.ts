import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { authRouter } from './routes';
import { logger } from './logger';

export const app = express();

// Security headers
app.use(helmet());

// JSON body parser
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'auth' });
});

// Mount auth router under /api/v1/auth
app.use('/api/v1/auth', authRouter);

// Global error handler (Express 5 handles async rejections automatically)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // express.json() gắn status 400 khi body JSON hỏng cú pháp - lỗi của client, không phải 500.
  if ((err as { status?: number }).status === 400) {
    res.status(400).json({ error: 'Input sai' });
    return;
  }
  logger.error({ err }, 'Lỗi hệ thống chưa bắt');
  res.status(500).json({ error: 'Lỗi hệ thống' });
});
