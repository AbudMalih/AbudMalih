/* Server-side backups of PostgreSQL + uploaded documents into BACKUP_DIR (persistent NAS folder).

   Archive format  jarbou-recruiting_YYYY-MM-DD_HHMMSS_<kind>.tar.gz containing
     manifest.json   – app/version/schema level/counts
     database.sql    – plain pg_dump (session data excluded)
     uploads/        – candidate document files

   Restore runs the SQL inside ONE transaction that first drops and recreates the schema, so a failed
   restore leaves the current database untouched. A safety backup is always taken first. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const db = require('./db');
const config = require('./config');
const log = require('./logger');
const { migrate, currentLevel } = require('./migrate');

const NAME_RE = /^jarbou-recruiting_(\d{4}-\d{2}-\d{2})_(\d{6})_(auto|manual|pre-restore|pre-update|uploaded)\.tar\.gz$/;
let busy = null;           // 'backup' | 'restore' | null
let maintenance = false;   // true while a restore replaces the database
let lastRun = { status: null, at: null, message: '' };
let lastAutoFailure = 0;

function pgEnv() {
  return Object.assign({}, process.env, { PGHOST: config.db.host, PGPORT: String(config.db.port), PGUSER: config.db.user, PGPASSWORD: config.db.password, PGDATABASE: config.db.database });
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, Object.assign({ env: pgEnv() }, opts || {}));
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-20000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`))));
  });
}

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function localDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function ensureDirs() {
  fs.mkdirSync(config.paths.backups, { recursive: true });
  fs.mkdirSync(config.paths.uploads, { recursive: true });
}

function listFiles() {
  ensureDirs();
  return fs.readdirSync(config.paths.backups).filter((f) => NAME_RE.test(f)).map((f) => {
    const m = NAME_RE.exec(f);
    const st = fs.statSync(path.join(config.paths.backups, f));
    const t = m[2];
    return { name: f, date: m[1], kind: m[3], size: st.size, createdAt: new Date(`${m[1]}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`).toISOString() };
  }).sort((a, b) => (a.name < b.name ? 1 : -1));
}

function fileFor(name) {
  if (!NAME_RE.test(name)) { const e = new Error('Unknown backup.'); e.status = 404; throw e; }
  const full = path.join(config.paths.backups, name);
  if (!fs.existsSync(full)) { const e = new Error('Backup file not found.'); e.status = 404; throw e; }
  return full;
}

async function counts() {
  const r = await db.query(`SELECT (SELECT count(*) FROM candidates)::int AS candidates, (SELECT count(*) FROM users)::int AS users,
    (SELECT count(*) FROM attachments)::int AS attachments, (SELECT count(*) FROM audit_logs)::int AS audit_entries`);
  return r.rows[0];
}

async function record(fileName, kind, status, size, startedAt, message, by) {
  try {
    await db.query('INSERT INTO backup_history (file_name, kind, status, size_bytes, started_at, finished_at, message, created_by) VALUES ($1,$2,$3,$4,$5,now(),$6,$7)',
      [fileName, kind === 'uploaded' ? 'manual' : kind, status, size || null, startedAt, (message || '').slice(0, 500), by || 'System']);
  } catch (e) { log.warn('Could not write backup history', { error: e.message }); }
}

/** Create a backup archive. kind: auto | manual | pre-restore | pre-update */
async function createBackup(kind, by) {
  if (busy) { const e = new Error(`A ${busy} is already running. Please wait.`); e.status = 409; throw e; }
  busy = 'backup';
  const started = new Date();
  const name = `jarbou-recruiting_${stamp(started)}_${kind}.tar.gz`;
  const tmp = path.join(config.paths.backups, `.tmp-${process.pid}-${Date.now()}`);
  try {
    ensureDirs();
    fs.mkdirSync(tmp, { recursive: true });
    await run('pg_dump', ['--no-owner', '--no-privileges', '--exclude-table-data=sessions', '--file', path.join(tmp, 'database.sql')]);
    const manifest = { app: 'jarbou-recruiting', format: 1, appVersion: config.version, createdAt: started.toISOString(), kind,
      schemaLevel: await currentLevel(), counts: await counts(), createdBy: by || 'System' };
    fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const partial = path.join(config.paths.backups, name + '.partial');
    // uploads are linked into the staging folder and archived with -h (works with BusyBox and GNU tar)
    fs.symlinkSync(config.paths.uploads, path.join(tmp, 'uploads'));
    await run('tar', ['-czhf', partial, '-C', tmp, 'manifest.json', 'database.sql', 'uploads']);
    fs.renameSync(partial, path.join(config.paths.backups, name));
    const size = fs.statSync(path.join(config.paths.backups, name)).size;
    lastRun = { status: 'success', at: new Date().toISOString(), message: name };
    await record(name, kind, 'success', size, started, '', by);
    log.info('Backup created', { file: name, size, kind });
    if (kind === 'auto') applyRetention();
    return { name, size, kind, manifest };
  } catch (err) {
    lastRun = { status: 'failed', at: new Date().toISOString(), message: err.message };
    await record(name, kind, 'failed', null, started, err.message, by);
    log.error('Backup failed', { error: err.message, kind });
    try { fs.unlinkSync(path.join(config.paths.backups, name + '.partial')); } catch (e) { /* ignore */ }
    throw Object.assign(new Error('Backup failed: ' + err.message), { status: err.status || 500, code: err.status === 409 ? 'conflict' : 'backup_failed' });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    busy = null;
  }
}

/** Keep the newest backup of the last N days, N ISO weeks and N months (automatic backups only). */
function applyRetention() {
  const auto = listFiles().filter((f) => f.kind === 'auto');
  const keep = new Set();
  const pick = (keyFn, limit) => {
    const seen = new Set();
    for (const f of auto) { const k = keyFn(f); if (!seen.has(k)) { seen.add(k); if (seen.size <= limit) keep.add(f.name); } }
  };
  pick((f) => f.date, config.backup.keepDaily);
  pick((f) => isoWeek(f.date), config.backup.keepWeekly);
  pick((f) => f.date.slice(0, 7), config.backup.keepMonthly);
  for (const f of auto) {
    if (!keep.has(f.name)) {
      try { fs.unlinkSync(path.join(config.paths.backups, f.name)); log.info('Old backup removed by retention policy', { file: f.name }); } catch (e) { /* ignore */ }
    }
  }
}
function isoWeek(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return d.getUTCFullYear() + '-W' + (1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7));
}

/** Read manifest.json from an archive without extracting everything. */
async function readManifest(file) {
  const tmp = path.join(config.paths.backups, `.inspect-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    await run('tar', ['-xzf', file, '-C', tmp, 'manifest.json']);
    const m = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
    if (m.app !== 'jarbou-recruiting') throw new Error('Not a JARBOU Recruiting backup.');
    return m;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/** Replace database and uploaded files with the content of a backup archive. */
async function restoreBackup(name, by) {
  const file = fileFor(name);
  const manifest = await readManifest(file);
  const safety = await createBackup('pre-restore', by);
  if (busy) { const e = new Error(`A ${busy} is already running. Please wait.`); e.status = 409; throw e; }
  busy = 'restore';
  const tmp = path.join(config.paths.backups, `.restore-${Date.now()}`);
  const started = new Date();
  let stage = 'db';
  try {
    fs.mkdirSync(tmp, { recursive: true });
    await run('tar', ['-xzf', file, '-C', tmp]);
    const sqlFile = path.join(tmp, 'database.sql');
    if (!fs.existsSync(sqlFile)) throw new Error('The backup does not contain a database dump.');
    // 1) Stage the backup's documents INSIDE the uploads folder (same disk → the later swap is a quick rename).
    const staged = path.join(config.paths.uploads, `.restore-new-${Date.now()}`);
    const previous = path.join(config.paths.uploads, `.restore-previous-${Date.now()}`);
    const fromBackup = path.join(tmp, 'uploads');
    fs.mkdirSync(staged, { recursive: true });
    if (fs.existsSync(fromBackup)) fs.cpSync(fromBackup, staged, { recursive: true, dereference: true });
    // 2) Restore the database atomically (DROP + CREATE + dump in ONE transaction).
    const wrapper = path.join(tmp, 'restore.sql');
    fs.writeFileSync(wrapper, 'DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n\\i ' + sqlFile.replace(/'/g, '') + '\n');
    maintenance = true;
    try {
      await run('psql', ['-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-f', wrapper], { cwd: tmp });
    } catch (e) {
      fs.rmSync(staged, { recursive: true, force: true });
      throw Object.assign(new Error('Restore failed – the previous database is unchanged. ' + e.message), { status: 500, code: 'restore_failed' });
    }
    stage = 'files';
    // 3) Swap document files: current → .restore-previous, staged → live (all renames on the same disk).
    fs.mkdirSync(previous, { recursive: true });
    for (const f of fs.readdirSync(config.paths.uploads)) {
      if (f.startsWith('.restore-')) continue;
      fs.renameSync(path.join(config.paths.uploads, f), path.join(previous, f));
    }
    for (const f of fs.readdirSync(staged)) fs.renameSync(path.join(staged, f), path.join(config.paths.uploads, f));
    fs.rmSync(staged, { recursive: true, force: true });
    fs.rmSync(previous, { recursive: true, force: true });
    stage = 'finish';
    await migrate();
    await db.query('DELETE FROM sessions');
    await record(name, 'manual', 'success', null, started, `Restored from ${name} (safety backup: ${safety.name})`, by);
    log.info('Backup restored', { file: name, safety: safety.name });
    return { restored: name, safetyBackup: safety.name, manifest };
  } catch (err) {
    if (stage === 'db') { log.error('Restore failed – the previous database is unchanged', { error: err.message }); throw err.code === 'restore_failed' ? err : Object.assign(new Error('Restore failed – the previous database is unchanged. ' + err.message), { status: 500, code: 'restore_failed' }); }
    log.error('Database restored, but a later step failed – check uploaded documents', { stage, error: err.message, safetyBackup: safety.name });
    throw Object.assign(new Error(`The database was restored, but the step "${stage}" failed: ${err.message}. Safety backup: ${safety.name}`), { status: 500, code: 'restore_partial' });
  } finally {
    maintenance = false;
    busy = null;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ---------------------------------------------------------------- scheduler */
function backupClock() {
  const m = config.backup.time.match(/^(\d{1,2}):(\d{2})$/);
  return m ? [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))] : [2, 30];
}

/** Time of the next automatic backup (local server time, Europe/Berlin by default). */
function nextScheduled(now) {
  now = now || new Date();
  const [h, m] = backupClock();
  const next = new Date(now); next.setHours(h, m, 0, 0);
  const doneToday = listFiles().some((f) => f.kind === 'auto' && f.date === localDate(now));
  if (doneToday) next.setDate(next.getDate() + 1);
  else if (next <= now) return new Date(now.getTime() + 60000); // overdue – runs within a minute
  return next;
}

function startScheduler() {
  if (!config.backup.enabled) { log.warn('Automatic backups are DISABLED (BACKUP_ENABLED=false)'); return; }
  const tick = async () => {
    try {
      const now = new Date();
      const [h, m] = backupClock();
      const due = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
      if (!due || busy) return;
      if (listFiles().some((f) => f.kind === 'auto' && f.date === localDate(now))) return;
      if (lastAutoFailure && Date.now() - lastAutoFailure < 60 * 60 * 1000) return; // retry at most hourly
      await createBackup('auto', 'System (scheduled)');
      lastAutoFailure = 0;
    } catch (e) { lastAutoFailure = Date.now(); /* already logged */ }
  };
  setInterval(tick, 60 * 1000).unref();
  setTimeout(tick, 30 * 1000).unref();
  log.info('Backup scheduler active', { backupTime: config.backup.time, timezone: config.timezone, dir: config.paths.backups });
}

module.exports = { createBackup, restoreBackup, listFiles, fileFor, readManifest, applyRetention, startScheduler, nextScheduled,
  status: () => ({ busy, lastRun }), isMaintenance: () => maintenance, NAME_RE, stamp };
