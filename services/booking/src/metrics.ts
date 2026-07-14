import { Router } from 'express';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';

// Counter in-memory theo spec (không Prometheus/Grafana); reset khi service restart.
export const counters = {
  totalRequests: 0,
  bookingsSuccess: 0,
  conflicts409: 0,
};

export const metricsRouter = Router();

// GET /api/v1/metrics - chỉ admin (US: quan sát hệ thống).
metricsRouter.get('/', (_req, res) => {
  const user = res.locals.user as JwtPayload;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Chỉ admin được xem metrics' });
    return;
  }
  res.json({ ...counters, uptimeSeconds: Math.round(process.uptime()) });
});
