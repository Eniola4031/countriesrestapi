import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import router from './routes/countries.js';
import { httpLogger, responseTimeHeader, logger } from './logger.js';
import { runMigrations } from './db/migrate.js';
import { getDb } from './db/index.js';

const { PORT = 5000, NODE_ENV = 'development' } = process.env;

async function main() {
  // Ensure DB is opened and schema is applied before serving traffic
  getDb();
  runMigrations();

  const app = express();

  // Core middlewares
  app.use(responseTimeHeader);
  app.use(httpLogger);
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // Routes
  app.use('/', router);

  // 404 handler (JSON only)
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    const body =
      status === 400
        ? { error: 'Validation failed' }
        : status === 404
          ? { error: 'Not found' }
          : status === 503
            ? { error: 'External data source unavailable' }
            : { error: 'Internal server error' };
    res.status(status).json(body);
  });

  app.listen(PORT, () => {
    logger.info({ port: PORT, env: NODE_ENV }, 'Server listening');
  });
}

main();
