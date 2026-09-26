/* JARBOU Recruiting Command Center – NAS edition server.
   Serves the frontend and the JSON API. Start-up: wait for PostgreSQL → migrate → first admin → listen. */
'use strict';
const express = require('express');
const path = require('path');
const config = require('./config');
const log = require('./logger');
const db = require('./db');
const { migrate } = require('./migrate');
const auth = require('./auth');
const backup = require('./backup');
const events = require('./events');
const { HttpError, wrap } = require('./errors');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy ? 1 : false);

/* ---------------------------------------------------------------- security headers */
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

/* ---------------------------------------------------------------- health (no auth, no sensitive data) */
app.get('/api/health', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (backup.isMaintenance()) return res.status(503).json({ status: 'maintenance', database: 'restoring', version: config.version });
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok', version: config.version });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'unavailable', version: config.version });
  }
}));

/* ---------------------------------------------------------------- API */
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (backup.isMaintenance()) return next(new HttpError(503, 'maintenance', 'A backup is being restored. Please wait a moment.'));
  next();
});
app.use('/api', auth.loadSession);
// Large JSON bodies only for the legacy import; everything else is limited to 1 MB.
app.use('/api/import', express.json({ limit: '60mb' }), auth.sameOrigin, auth.requireAuth, require('./routes-import'));
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api/auth', auth.router);
app.use('/api', auth.sameOrigin, auth.requireAuth);
app.get('/api/events', (req, res) => events.subscribe(req, res));
app.use('/api/candidates', require('./routes-candidates'));
app.use('/api', require('./attachments').router);
const settings = require('./routes-settings');
app.use('/api/settings', settings.router);
app.use('/api/me', settings.prefsRouter);
app.use('/api/users', require('./routes-users'));
const auditRoutes = require('./routes-audit');
app.use('/api/audit', auditRoutes.auditRouter);
app.use('/api/activity', auditRoutes.activityRouter);
app.use('/api/backups', require('./routes-backups'));
app.use('/api', (req, res, next) => next(new HttpError(404, 'not_found', 'Unknown API endpoint.')));

/* ---------------------------------------------------------------- frontend (static) */
app.use(express.static(config.paths.frontend, {
  index: 'index.html',
  setHeaders: (res, file) => {
    // Always revalidate so users get new versions after an update.
    res.set('Cache-Control', /\.(svg|png|ico)$/.test(file) ? 'public, max-age=86400' : 'no-cache');
  }
}));
// Unknown files → 404 (never serve the app shell for missing scripts/styles).
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).type('text/plain').send('Not found');
  res.sendFile(path.join(config.paths.frontend, 'index.html'));
});

/* ---------------------------------------------------------------- errors */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let code = err.code;
  let message = err.message;
  if (err instanceof HttpError) {
    // expected error
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'too_large'; message = 'The request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'validation'; message = 'Invalid request.';
  } else if (err.code === '23505') {
    status = 409; code = 'duplicate'; message = 'This entry already exists.';
  } else if (err.code === '23514' || err.code === '22P02' || err.code === '22007' || err.code === '22008' || err.code === '22003') {
    status = 400; code = 'validation'; message = 'Invalid value.';
  } else if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === '57P03' || /connect|terminat/i.test(err.message || '') && !err.status) {
    status = 503; code = 'db_unavailable'; message = 'Database temporarily unavailable. Please try again in a moment.';
  } else if (status >= 500 || !code) {
    log.error('Unexpected error', { method: req.method, path: req.path, error: err.message, stack: config.production ? undefined : err.stack });
    status = status >= 400 ? status : 500; code = err.code && typeof err.code === 'string' && /^[a-z_]+$/.test(err.code) ? err.code : 'internal';
    if (status === 500 && code === 'internal') message = 'An unexpected error occurred. Please try again.';
  }
  if (res.headersSent) return;
  res.status(status).json({ error: code || 'error', message, details: err.details });
});

/* ---------------------------------------------------------------- start */
async function start() {
  log.info('Starting JARBOU Recruiting Command Center', { version: config.version, mode: config.production ? 'production' : 'development', timezone: config.timezone });
  if (!config.appSecret || config.appSecret.length < 32 || /CHANGE-ME/.test(config.appSecret)) log.warn('APP_SECRET is missing, short or still the example value – please set a long random value in .env');
  if (config.production && (!config.db.password || config.db.password.length < 12)) log.warn('POSTGRES_PASSWORD is empty or short – please set a strong password in .env');
  await db.waitForDatabase(120);
  await migrate();
  await auth.ensureInitialAdmin();
  await auth.cleanupSessions();
  setInterval(auth.cleanupSessions, 60 * 60 * 1000).unref();
  backup.startScheduler();
  const server = app.listen(config.port, () => log.info('Listening', { port: config.port }));
  server.keepAliveTimeout = 65000;
  const stop = (sig) => {
    log.info('Shutting down', { signal: sig });
    server.close(() => db.pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (require.main === module) {
  start().catch((err) => { log.error('Start-up failed', { error: err.message }); process.exit(1); });
}

module.exports = { app, start };
