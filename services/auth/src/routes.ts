import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import sql from 'mssql';
import rateLimit from 'express-rate-limit';
import { getPool } from './db';
import { logger } from './logger';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';
import { UsersMeResponse } from '../../../shared/contracts/users-me-response';

export const authRouter = Router();

// Zod schemas for validation
const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  displayName: z.string().min(1, 'Tên hiển thị không được để trống').optional(),
  role: z.enum(['user', 'admin']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

// Rate limit cho login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 10, // Tối đa 10 lần đăng nhập sai từ 1 IP trong windowMs
  message: { error: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware requireAuth để bảo vệ endpoint /users/me
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Thiếu token' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    res.locals.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

// POST /api/v1/auth/register
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Input sai', details: parsed.error.issues });
    return;
  }

  const { email, password, displayName, role = 'user' } = parsed.data;
  const derivedDisplayName = displayName || email.split('@')[0];

  try {
    const pool = await getPool();

    // Check trùng email trước khi tạo
    const checkEmail = await pool
      .request()
      .input('email', sql.NVarChar(256), email)
      .query('SELECT id FROM dbo.[User] WHERE email = @email');

    if (checkEmail.recordset.length > 0) {
      res.status(409).json({ error: 'Email đã tồn tại' });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user mới
    const result = await pool
      .request()
      .input('email', sql.NVarChar(256), email)
      .input('passwordHash', sql.VarChar(255), passwordHash)
      .input('displayName', sql.NVarChar(256), derivedDisplayName)
      .input('role', sql.VarChar(10), role)
      .query(`
        INSERT INTO dbo.[User] (email, password_hash, display_name, role)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.display_name, INSERTED.role
        VALUES (@email, @passwordHash, @displayName, @role)
      `);

    const newUser = result.recordset[0];
    logger.info({ userId: newUser.id, email: newUser.email, role: newUser.role }, 'Đăng ký tài khoản thành công');

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.display_name,
      role: newUser.role,
    });
  } catch (err) {
    logger.error({ err }, 'Lỗi hệ thống khi đăng ký');
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

// POST /api/v1/auth/login
authRouter.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Input sai', details: parsed.error.issues });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('email', sql.NVarChar(256), email)
      .query('SELECT id, email, password_hash, display_name, role FROM dbo.[User] WHERE email = @email');

    if (result.recordset.length === 0) {
      logger.info({ email }, 'Đăng nhập thất bại - Email không tồn tại');
      res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác' });
      return;
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      logger.info({ email }, 'Đăng nhập thất bại - Mật khẩu sai');
      res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác' });
      return;
    }

    // Tạo JWT token
    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1d' });

    logger.info({ userId: user.id, email: user.email }, 'Đăng nhập thành công');
    res.status(200).json({ token });
  } catch (err) {
    logger.error({ err }, 'Lỗi hệ thống khi đăng nhập');
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

// GET /api/v1/auth/users/me
authRouter.get('/users/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const payload = res.locals.user as JwtPayload;

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, payload.userId)
      .query('SELECT display_name, email FROM dbo.[User] WHERE id = @id');

    if (result.recordset.length === 0) {
      res.status(401).json({ error: 'Không tìm thấy người dùng' });
      return;
    }

    const user = result.recordset[0];
    const responseBody: UsersMeResponse = {
      displayName: user.display_name,
      email: user.email,
    };

    res.status(200).json(responseBody);
  } catch (err) {
    logger.error({ err }, 'Lỗi hệ thống khi lấy thông tin cá nhân');
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});
