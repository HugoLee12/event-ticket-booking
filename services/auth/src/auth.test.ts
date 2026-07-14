import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from './app';
import { closePool, getPool } from './db';
import { initDb } from './init';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';

const testEmail = 'auth-test@example.com';
const testPassword = 'Password123!';
const testDisplayName = 'Auth Test User';

beforeAll(async () => {
  await initDb();
  const pool = await getPool();
  // Dọn dẹp user test cũ nếu có
  await pool.request().input('email', testEmail).query('DELETE FROM dbo.[User] WHERE email = @email');
});

afterAll(async () => {
  const pool = await getPool();
  await pool.request().input('email', testEmail).query('DELETE FROM dbo.[User] WHERE email = @email');
  await closePool();
});

describe('Auth Service integration tests', () => {
  test('POST /api/v1/auth/register - đăng ký thành công -> 201', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(Number),
      email: testEmail,
      displayName: testDisplayName,
      role: 'user',
    });
  });

  test('POST /api/v1/auth/register - email trùng -> 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(409);

    expect(res.body.error).toBe('Email đã tồn tại');
  });

  test('POST /api/v1/auth/register - input không hợp lệ -> 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'email-sai-dinh-dang',
        password: '123',
      })
      .expect(400);

    expect(res.body.error).toBe('Input sai');
  });

  test('POST /api/v1/auth/login - sai mật khẩu -> 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'sai-mat-khau',
      })
      .expect(401);

    expect(res.body.error).toBe('Tài khoản hoặc mật khẩu không chính xác');
  });

  test('POST /api/v1/auth/login - đăng nhập thành công -> 200 kèm token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET as string) as JwtPayload;
    expect(decoded.email).toBe(testEmail);
    expect(decoded.role).toBe('user');
    expect(decoded.userId).toBeDefined();
  });

  test('GET /api/v1/auth/users/me - thiếu token -> 401', async () => {
    await request(app).get('/api/v1/auth/users/me').expect(401);
  });

  test('GET /api/v1/auth/users/me - token hợp lệ -> 200 trả về profile', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/v1/auth/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      displayName: testDisplayName,
      email: testEmail,
    });
  });
});
