import { Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { JwtPayload } from '../../../shared/contracts/jwt-payload';
import { fetchUserProfile } from './auth-client';
import { getPool } from './db';
import { logger } from './logger';
import { counters } from './metrics';

const bodySchema = z.object({ seatId: z.number().int().positive() });

export const bookingsRouter = Router();

// POST /api/v1/bookings - đặt 1 ghế, chống double-booking 2 tầng (ADR-0001):
// optimistic locking qua ROWVERSION (0 dòng bị ảnh hưởng -> 409) + UNIQUE Booking.seat_id làm chốt chặn cuối.
bookingsRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Input sai', details: parsed.error.issues });
    return;
  }
  const { seatId } = parsed.data;
  const user = res.locals.user as JwtPayload;

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let bookingId: number;
  try {
    const seatRs = await new sql.Request(tx)
      .input('seatId', sql.Int, seatId)
      .query('SELECT status, row_version FROM dbo.Seat WHERE id = @seatId');
    if (seatRs.recordset.length === 0) {
      await tx.rollback();
      res.status(404).json({ error: 'Ghế không tồn tại' });
      return;
    }
    const seat = seatRs.recordset[0];
    if (seat.status !== 'free') {
      await tx.rollback();
      counters.conflicts409++;
      logger.info({ seatId, userId: user.userId }, 'đặt ghế đã booked -> 409');
      res.status(409).json({ error: 'Ghế đã có người đặt' });
      return;
    }

    const updated = await new sql.Request(tx)
      .input('seatId', sql.Int, seatId)
      .input('rowVersion', sql.VarBinary(8), seat.row_version)
      .query("UPDATE dbo.Seat SET status = 'booked' WHERE id = @seatId AND row_version = @rowVersion");
    if (updated.rowsAffected[0] === 0) {
      await tx.rollback();
      counters.conflicts409++;
      logger.info({ seatId, userId: user.userId }, 'thua optimistic locking -> 409');
      res.status(409).json({ error: 'Ghế vừa bị người khác đặt, hãy thử lại' });
      return;
    }

    const inserted = await new sql.Request(tx)
      .input('seatId', sql.Int, seatId)
      .input('userId', sql.Int, user.userId)
      .query('INSERT INTO dbo.Booking (seat_id, user_id) OUTPUT INSERTED.id VALUES (@seatId, @userId)');
    bookingId = inserted.recordset[0].id;
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    // 2627/2601 = vi phạm UNIQUE trên Booking.seat_id - chốt chặn cuối chống double-booking.
    const sqlErrorNumber = (err as { number?: number }).number;
    if (sqlErrorNumber === 2627 || sqlErrorNumber === 2601) {
      counters.conflicts409++;
      logger.info({ seatId, userId: user.userId }, 'dính UNIQUE seat_id -> 409');
      res.status(409).json({ error: 'Ghế đã có người đặt' });
      return;
    }
    throw err;
  }

  counters.bookingsSuccess++;
  const profile = await fetchUserProfile(req.headers.authorization as string);
  logger.info({ bookingId, seatId, userId: user.userId, coTenUser: profile !== null }, 'đặt vé thành công');
  // profile null = fallback khi Auth chậm/sập: booking vẫn thành công, xác nhận thiếu tên (ADR-0002).
  res.status(201).json({ bookingId, seatId, user: profile });
});
