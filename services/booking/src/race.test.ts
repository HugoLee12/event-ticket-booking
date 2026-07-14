import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';
import { app } from './app';
import { closePool, getPool } from './db';
import { initDb } from './init';

// Bằng chứng thực nghiệm cho optimistic locking ROWVERSION (ADR-0001):
// bắn N request đồng thời vào cùng 1 ghế cuối, chỉ đúng 1 request được thắng.

const N = 20;

const token = jwt.sign(
  { userId: 201, role: 'user', email: 'race@example.com' } satisfies JwtPayload,
  process.env.JWT_SECRET as string,
);

let eventId: number;
let seatId: number;

beforeAll(async () => {
  process.env.AUTH_BASE_URL = 'http://localhost:59999';
  await initDb();
  const pool = await getPool();
  const eventRs = await pool
    .request()
    .query("INSERT INTO dbo.Event (name, starts_at) OUTPUT INSERTED.id VALUES (N'[test] race', '2099-01-01')");
  eventId = eventRs.recordset[0].id;
  const seatRs = await pool
    .request()
    .input('eventId', eventId)
    .query("INSERT INTO dbo.Seat (event_id, label) OUTPUT INSERTED.id VALUES (@eventId, 'R1')");
  seatId = seatRs.recordset[0].id;
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

test(
  `${N} request đồng thời đặt cùng 1 ghế -> đúng 1 thành công, còn lại 409, 0 double-booking`,
  async () => {
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        request(app).post('/api/v1/bookings').set('Authorization', `Bearer ${token}`).send({ seatId }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 201);
    const conflicted = results.filter((r) => r.status === 409);
    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(N - 1);

    const pool = await getPool();
    const bookings = await pool
      .request()
      .input('id', seatId)
      .query('SELECT COUNT(*) AS n FROM dbo.Booking WHERE seat_id = @id');
    expect(bookings.recordset[0].n).toBe(1);
  },
  20000,
);
