import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`auth service listening on port ${port}`);
});
