import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../logger.js';

const { SQLITE_DB_PATH = './data/app.db', NODE_ENV = 'development' } = process.env;

let db;

export function getDb() {
  if (db) return db;

  const dbFile = path.resolve(SQLITE_DB_PATH);
  const dir = path.dirname(dbFile);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbFile, {
    fileMustExist: false,
    verbose: NODE_ENV !== 'production' ? (msg) => logger.debug({ sql: msg }) : undefined,
  });

  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -32000');
  db.pragma('temp_store = MEMORY');

  logger.info({ dbFile }, 'SQLite opened');

  return db;
}
export function runInTransaction(fn) {
  const _db = getDb();
  const wrap = _db.transaction((...args) => fn(_db, ...args));
  return wrap();
}

export function tableExists(tableName) {
  const _db = getDb();
  const row = _db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName);
  return !!row;
}
