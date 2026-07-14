import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';
import { app } from './app';
import { closePool } from './db';
import { initDb } from './init';

// Test tại seam HTTP với SQL Server thật (cần `docker compose up mssql` trước khi chạy).
beforeAll(async () => {
  await initDb();
});

afterAll(async () => {
  await closePool();
});

test('GET /api/v1/events không có token -> 401', async () => {
  await request(app).get('/api/v1/events').expect(401);
});

test('GET /api/v1/events token sai -> 401', async () => {
  await request(app)
    .get('/api/v1/events')
    .set('Authorization', 'Bearer token-rac')
    .expect(401);
});

test('GET /api/v1/events token hợp lệ -> 200 kèm danh sách sự kiện + ghế', async () => {
  const payload: JwtPayload = { userId: 1, role: 'user', email: 'test@example.com' };
  const token = jwt.sign(payload, process.env.JWT_SECRET as string);

  const res = await request(app)
    .get('/api/v1/events')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.body.length).toBeGreaterThanOrEqual(2);
  const event = res.body[0];
  expect(event).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
  expect(event.seats.length).toBeGreaterThan(0);
  expect(event.seats[0]).toMatchObject({
    id: expect.any(Number),
    label: expect.any(String),
    status: expect.stringMatching(/^(free|booked)$/),
  });
});
