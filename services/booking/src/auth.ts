import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';

// Booking verify JWT cục bộ bằng shared secret, không gọi Auth Service (ADR-0002).
// Payload đã verify được gắn vào res.locals.user (kiểu JwtPayload).
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Thiếu token' });
    return;
  }
  try {
    res.locals.user = jwt.verify(token, process.env.JWT_SECRET as string, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
}
