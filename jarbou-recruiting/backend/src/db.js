/* PostgreSQL access. All queries are parameterised – never build SQL from user input. */
'use strict';
const { Pool, types } = require('pg');
const config = require('./config');
const log = require('./logger');

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting) and NUMERIC as numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const pool = new Pool({ ...config.db, max: 15, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000 });
pool.on('error', (err) => log.error('PostgreSQL pool error', { error: err.message }));

async function query(text, params) { return pool.query(text, params); }

/** Run fn(client) inside a transaction; rolls back on any error. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function waitForDatabase(maxSeconds) {
  const until = Date.now() + (maxSeconds || 90) * 1000;
  let attempt = 0;
  for (;;) {
    attempt++;
    try { await pool.query('SELECT 1'); log.info('Database connection established'); return; }
    catch (err) {
      if (Date.now() > until) throw new Error('Database not reachable: ' + err.message);
      if (attempt === 1 || attempt % 5 === 0) log.warn('Waiting for database…', { attempt, error: err.code || err.message });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

module.exports = { pool, query, tx, waitForDatabase };
