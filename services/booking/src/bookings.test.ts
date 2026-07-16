import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';
import { app } from './app';
import { closePool, getPool } from './db';
import { initDb } from './init';

// Test tại seam HTTP với SQL Server thật (cần `docker compose up mssql`).
// Auth Service KHÔNG chạy trong test -> mọi lời gọi /users/me đi vào fallback (ADR-0002),
// nên happy path 201 với user: null đồng thời là test resilience fallback theo spec.

function tokenFor(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string);
}

const userToken = tokenFor({ userId: 101, role: 'user', email: 'user@example.com' });
const adminToken = tokenFor({ userId: 102, role: 'admin', email: 'admin@example.com' });

// Event + ghế riêng cho test (tạo trong beforeAll, dọn trong afterAll) để test chạy lại được
// nhiều lần trên cùng DB mà không đụng dữ liệu seed.
let eventId: number;
let seatIds: number[];

beforeAll(async () => {
  // Fallback phải fail nhanh: trỏ Auth vào cổng không ai lắng nghe.
  process.env.AUTH_BASE_URL = 'http://localhost:59999';

  await initDb();
  const pool = await getPool();
  const eventRs = await pool
    .request()
    .query("INSERT INTO dbo.Event (name, starts_at) OUTPUT INSERTED.id VALUES (N'[test] booking', '2099-01-01')");
  eventId = eventRs.recordset[0].id;
  const seatRs = await pool
    .request()
    .input('eventId', eventId)
    .query(`INSERT INTO dbo.Seat (event_id, label) OUTPUT INSERTED.id
            VALUES (@eventId, 'T1'), (@eventId, 'T2'), (@eventId, 'T3')`);
  seatIds = seatRs.recordset.map((r: { id: number }) => r.id);
});

afterAll(async () => {
  const pool = await getPool();
  await pool.request().input('eventId', eventId).query(`
    DELETE FROM dbo.Booking WHERE seat_id IN (SELECT id FROM dbo.Seat WHERE event_id = @eventId);
    DELETE FROM dbo.Seat WHERE event_id = @eventId;
    DELETE FROM dbo.Event WHERE id = @eventId;
  `);
  await closePool();
});

test('POST /api/v1/bookings không có token -> 401', async () => {
  await request(app).post('/api/v1/bookings').send({ seatId: 1 }).expect(401);
});

test('POST /api/v1/bookings token sai -> 401', async () => {
  await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', 'Bearer token-rac')
    .send({ seatId: 1 })
    .expect(401);
});

test('POST /api/v1/bookings body sai -> 400', async () => {
  await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ seatId: 'khong-phai-so' })
    .expect(400);
});

test('POST /api/v1/bookings seatId vượt phạm vi INT -> 400', async () => {
  await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ seatId: 3000000000 })
    .expect(400);
});

test('POST /api/v1/bookings body JSON hỏng cú pháp -> 400', async () => {
  await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${userToken}`)
    .set('Content-Type', 'application/json')
    .send('{"seatId":')
    .expect(400);
});

test('GET /health có security header của helmet', async () => {
  const res = await request(app).get('/health').expect(200);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
});

test('POST /api/v1/bookings ghế không tồn tại -> 404', async () => {
  await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ seatId: 99999999 })
    .expect(404);
});

test('POST /api/v1/bookings ghế trống -> 201, Auth tắt nên xác nhận thiếu tên (fallback)', async () => {
  const res = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ seatId: seatIds[0] })
    .expect(201);

  expect(res.body).toMatchObject({ bookingId: expect.any(Number), seatId: seatIds[0], user: null });

  // Trạng thái quan sát được sau thao tác: ghế chuyển booked, đúng 1 Booking cho ghế đó.
  const pool = await getPool();
  const seat = await pool.request().input('id', seatIds[0]).query('SELECT status FROM dbo.Seat WHERE id = @id');
  expect(seat.recordset[0].status).toBe('booked');
  const bookings = await pool
    .request()
    .input('id', seatIds[0])
    .query('SELECT COUNT(*) AS n FROM dbo.Booking WHERE seat_id = @id');
  expect(bookings.recordset[0].n).toBe(1);
});

test('POST /api/v1/bookings ghế đã có người -> 409', async () => {
  await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ seatId: seatIds[1] })
    .expect(201);

  const res = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ seatId: seatIds[1] })
    .expect(409);
  expect(res.body.error).toBeDefined();
});

test('GET /api/v1/metrics không có token -> 401', async () => {
  await request(app).get('/api/v1/metrics').expect(401);
});

test('GET /api/v1/metrics với role user -> 403', async () => {
  await request(app).get('/api/v1/metrics').set('Authorization', `Bearer ${userToken}`).expect(403);
});

test('GET /api/v1/metrics với role admin -> 200 kèm counter', async () => {
  const res = await request(app)
    .get('/api/v1/metrics')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(res.body).toMatchObject({
    totalRequests: expect.any(Number),
    bookingsSuccess: expect.any(Number),
    conflicts409: expect.any(Number),
    uptimeSeconds: expect.any(Number),
  });
  // Các test phía trên đã tạo ít nhất 2 booking thành công và 1 lần 409.
  expect(res.body.bookingsSuccess).toBeGreaterThanOrEqual(2);
  expect(res.body.conflicts409).toBeGreaterThanOrEqual(1);
});
