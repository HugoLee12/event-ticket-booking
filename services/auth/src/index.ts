import { app } from './app';
import { initDb } from './init';
import { logger } from './logger';

if (!process.env.JWT_SECRET) {
  logger.error({}, 'Thiếu biến môi trường JWT_SECRET');
  process.exit(1);
}

const port = Number(process.env.PORT) || 3001;

initDb()
  .then(() => {
    app.listen(port, () => {
      logger.info({ port }, 'auth service đã khởi động');
    });
  })
  .catch((err) => {
    logger.error({ err }, 'khởi tạo DB thất bại');
    process.exit(1);
  });
