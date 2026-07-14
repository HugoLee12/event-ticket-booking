import type { Server } from 'node:http';
import request from 'supertest';
import { app as authApp } from '../../auth/src/app';
import { initDb as initAuthDb } from '../../auth/src/init';
import { closePool as closeAuthPool, getPool as getAuthPool } from '../../auth/src/db';
import { app as bookingApp } from './app';
import { initDb as initBookingDb } from './init';
import { closePool as closeBookingPool, getPool as getBookingPool } from './db';

// Happy path E2E liên service (spec mục Testing Decisions): đăng ký -> đăng nhập -> lấy JWT ->
// xem events -> đặt vé, chạm cả Auth lẫn Booking tại seam HTTP REST.
// Khác các test khác của Booking (Auth tắt -> fallback null): ở đây Auth CHẠY THẬT, nên bằng chứng
// tích hợp là booking 201 trả kèm hồ sơ user (user !== null) - đúng luồng Booking gọi Auth /users/me.

const AUTH_PORT = 3999; // cổng riêng, tránh đụng container auth (3001) nếu Docker đang chạy.
const testEmail = 'e2e-user@example.com';
const testPassword = 'Password123!';
const testDisplayName = 'E2E User';

let authServer: Server;
let eventId: number;
let seatId: number;

beforeAll(async () => {
  // Booking gọi Auth qua fetch tới AUTH_BASE_URL -> phải là server thật đang lắng nghe.
  process.env.AUTH_BASE_URL = `http://localhost:${AUTH_PORT}`;

  await initAuthDb();
  await initBookingDb();
  authServer = authApp.listen(AUTH_PORT);

  // Dọn user test cũ (idempotent để chạy lại nhiều lần).
  const authPool = await getAuthPool();
  await authPool.request().input('email', testEmail).query('DELETE FROM dbo.[User] WHERE email = @email');

  // Event + 1 ghế riêng cho test, dọn ở afterAll.
  const bookingPool = await getBookingPool();
  const eventRs = await bookingPool
    .request()
    .query("INSERT INTO dbo.Event (name, starts_at) OUTPUT INSERTED.id VALUES (N'[e2e] happy path', '2099-01-01')");
  eventId = eventRs.recordset[0].id;
  const seatRs = await bookingPool
    .request()
    .input('eventId', eventId)
    .query("INSERT INTO dbo.Seat (event_id, label) OUTPUT INSERTED.id VALUES (@eventId, 'E2E-1')");
  seatId = seatRs.recordset[0].id;
});

afterAll(async () => {
  const bookingPool = await getBookingPool();
  await bookingPool.request().input('seatId', seatId).query('DELETE FROM dbo.Booking WHERE seat_id = @seatId');
  await bookingPool.request().input('seatId', seatId).query('DELETE FROM dbo.Seat WHERE id = @seatId');
  await bookingPool.request().input('eventId', eventId).query('DELETE FROM dbo.Event WHERE id = @eventId');

  const authPool = await getAuthPool();
  await authPool.request().input('email', testEmail).query('DELETE FROM dbo.[User] WHERE email = @email');

  await new Promise<void>((resolve) => authServer.close(() => resolve()));
  await closeAuthPool();
  await closeBookingPool();
});

test('happy path: đăng ký -> đăng nhập -> events -> đặt vé (Booking gọi Auth thật)', async () => {
  // 1. Đăng ký tại Auth Service.
  await request(authApp)
    .post('/api/v1/auth/register')
    .send({ email: testEmail, password: testPassword, displayName: testDisplayName })
    .expect(201);

  // 2. Đăng nhập lấy JWT.
  const loginRes = await request(authApp)
    .post('/api/v1/auth/login')
    .send({ email: testEmail, password: testPassword })
    .expect(200);
  const token = loginRes.body.token as string;
  expect(token).toBeDefined();

  // 3. Xem events tại Booking Service với JWT do Auth ký (verify cục bộ bằng shared secret).
  const eventsRes = await request(bookingApp)
    .get('/api/v1/events')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(Array.isArray(eventsRes.body)).toBe(true);

  // 4. Đặt ghế -> 201, và vì Auth CHẠY THẬT nên xác nhận kèm hồ sơ user (bằng chứng tích hợp liên service).
  const bookingRes = await request(bookingApp)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({ seatId })
    .expect(201);

  expect(bookingRes.body.seatId).toBe(seatId);
  expect(bookingRes.body.bookingId).toEqual(expect.any(Number));
  expect(bookingRes.body.user).toEqual({ displayName: testDisplayName, email: testEmail });
});
