import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './index.js';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations() {
  const db = getDb();

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    db.exec('BEGIN');
    db.exec(sql);
    db.exec('COMMIT');
    logger.info('Database schema applied successfully');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {}
    logger.error({ err }, 'Failed to apply database schema');
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runMigrations();
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
}
