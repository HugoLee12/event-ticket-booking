import { app } from './app';
import { initDb } from './init';

if (!process.env.JWT_SECRET) {
  console.error('Thiếu biến môi trường JWT_SECRET');
  process.exit(1);
}

const port = Number(process.env.PORT) || 3002;

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`booking service listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Khởi tạo DB thất bại', err);
    process.exit(1);
  });
