import sql from 'mssql';
import { dbConfig, getPool } from './db';

// Bootstrap idempotent: chạy mỗi lần service khởi động, an toàn khi chạy lặp lại.
// Quy ước chung 2 service: mỗi service tự tạo bảng của mình trong DB `tickets` theo cách này
// (Auth Service áp dụng cùng pattern cho bảng [User]).
export async function initDb(): Promise<void> {
  // DB có thể chưa tồn tại nên phải nối vào master để tạo trước.
  const master = await new sql.ConnectionPool({ ...dbConfig, database: 'master' }).connect();
  try {
    await master
      .request()
      .query(`IF DB_ID('${dbConfig.database}') IS NULL CREATE DATABASE [${dbConfig.database}]`);
  } catch (err) {
    // 1801 = DB đã tồn tại: 2 service cùng boot trên volume sạch có thể cùng qua check DB_ID
    // rồi cùng CREATE - bên thua coi như mục tiêu đã đạt, không được chết.
    if ((err as { number?: number }).number !== 1801) throw err;
  } finally {
    await master.close();
  }

  const pool = await getPool();

  // ponytail: Booking.user_id không có FK sang [User] dù spec phác thảo có -
  // bảng [User] do Auth Service tạo, FK chéo service sẽ vỡ nếu Booking boot trước Auth.
  await pool.request().batch(`
    IF OBJECT_ID('dbo.Event') IS NULL
      CREATE TABLE dbo.Event (
        id INT IDENTITY PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        starts_at DATETIME2 NOT NULL
      );

    IF OBJECT_ID('dbo.Seat') IS NULL
      CREATE TABLE dbo.Seat (
        id INT IDENTITY PRIMARY KEY,
        event_id INT NOT NULL REFERENCES dbo.Event(id),
        label NVARCHAR(20) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'booked')),
        row_version ROWVERSION
      );

    IF OBJECT_ID('dbo.Booking') IS NULL
      CREATE TABLE dbo.Booking (
        id INT IDENTITY PRIMARY KEY,
        seat_id INT NOT NULL UNIQUE REFERENCES dbo.Seat(id),
        user_id INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
  `);

  const count = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.Event');
  if (count.recordset[0].n > 0) return;

  const inserted = await pool.request().query(`
    INSERT INTO dbo.Event (name, starts_at)
    OUTPUT INSERTED.id
    VALUES
      (N'Đêm nhạc Trịnh Công Sơn', '2026-08-15T19:30:00'),
      (N'Workshop Software Engineering', '2026-08-20T09:00:00');
  `);

  for (const row of inserted.recordset) {
    const values = Array.from({ length: 10 }, (_, i) => `(${row.id}, 'A${i + 1}')`).join(', ');
    await pool.request().query(`INSERT INTO dbo.Seat (event_id, label) VALUES ${values}`);
  }
}
