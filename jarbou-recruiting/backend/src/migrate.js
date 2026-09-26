/* Forward-only SQL migrations from database/migrations (001_*.sql, 002_*.sql, …).
   Each file runs once inside a transaction and is recorded in schema_migrations.
   A PostgreSQL advisory lock prevents two processes migrating at the same time. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');
const log = require('./logger');

const LOCK_ID = 740215; // arbitrary constant for pg_advisory_lock

async function migrate() {
  const client = await db.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Map((await client.query('SELECT name, checksum FROM schema_migrations')).rows.map((r) => [r.name, r.checksum]));
    const files = fs.readdirSync(config.paths.migrations).filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();
    let applied = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(config.paths.migrations, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      if (done.has(file)) {
        if (done.get(file) !== checksum) log.warn('Applied migration file has changed on disk – ignoring changes', { file });
        continue;
      }
      log.info('Applying migration', { file });
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        applied++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    log.info('Database schema up to date', { applied, total: files.length });
    return applied;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]); } catch (e) { /* ignore */ }
    client.release();
  }
}

async function currentLevel() {
  const r = await db.query("SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1").catch(() => ({ rows: [] }));
  return r.rows[0] ? r.rows[0].name : null;
}

module.exports = { migrate, currentLevel };
