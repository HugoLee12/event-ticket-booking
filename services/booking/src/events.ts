import { Router } from 'express';
import { getPool } from './db';

export const eventsRouter = Router();

// GET /api/v1/events - danh sách sự kiện kèm toàn bộ ghế (US-3).
eventsRouter.get('/', async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT e.id AS eventId, e.name, e.starts_at AS startsAt,
           s.id AS seatId, s.label, s.status
    FROM dbo.Event e
    LEFT JOIN dbo.Seat s ON s.event_id = e.id
    ORDER BY e.id, s.id
  `);

  const events = new Map<number, { id: number; name: string; startsAt: Date; seats: object[] }>();
  for (const row of result.recordset) {
    let event = events.get(row.eventId);
    if (!event) {
      event = { id: row.eventId, name: row.name, startsAt: row.startsAt, seats: [] };
      events.set(row.eventId, event);
    }
    if (row.seatId !== null) {
      event.seats.push({ id: row.seatId, label: row.label, status: row.status });
    }
  }
  res.json([...events.values()]);
});
