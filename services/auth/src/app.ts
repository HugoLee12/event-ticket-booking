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
  logger.error({ err }, 'Lỗi hệ thống chưa bắt');
  res.status(500).json({ error: 'Lỗi hệ thống' });
});
