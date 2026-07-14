import sql from 'mssql';
import { dbConfig, getPool } from './db';
import { logger } from './logger';

export async function initDb(): Promise<void> {
  // DB có thể chưa tồn tại nên phải nối vào master để tạo trước.
  const master = await new sql.ConnectionPool({ ...dbConfig, database: 'master' }).connect();
  try {
    await master
      .request()
      .query(`IF DB_ID('${dbConfig.database}') IS NULL CREATE DATABASE [${dbConfig.database}]`);
  } finally {
    await master.close();
  }

  const pool = await getPool();

  // Tạo bảng [User] nếu chưa tồn tại
  await pool.request().batch(`
    IF OBJECT_ID('dbo.[User]') IS NULL
      CREATE TABLE dbo.[User] (
        id INT IDENTITY PRIMARY KEY,
        email NVARCHAR(256) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name NVARCHAR(256) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
  `);

  logger.info({}, 'Khởi tạo DB Auth Service thành công');
}
