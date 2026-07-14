import sql from 'mssql';

export const dbConfig: sql.config = {
  server: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || process.env.MSSQL_SA_PASSWORD || '',
  database: process.env.DB_NAME || 'tickets',
  options: {
    trustServerCertificate: true,
  },
};

let pool: sql.ConnectionPool | undefined;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await new sql.ConnectionPool(dbConfig).connect();
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = undefined;
  }
}
