/* Authentication: server-side sessions in PostgreSQL, HttpOnly cookie, CSRF token,
   login rate limiting, password change, first administrator bootstrap. */
'use strict';
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const config = require('./config');
const log = require('./logger');
const audit = require('./audit');
const passwords = require('./passwords');
const { permissionsFor } = require('./rbac');
const { wrap, badRequest, unauthorized, forbidden, tooMany } = require('./errors');

const COOKIE = 'jrc_session';
// Session tokens are stored only as keyed hashes (HMAC with APP_SECRET): a database copy alone cannot be used to sign in.
const sha256 = (s) => crypto.createHmac('sha256', config.appSecret || 'jarbou-recruiting').update(s).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');

/* ------------------------------------------------------------------ cookies */
function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function isSecure(req) {
  if (config.cookieSecure === 'true') return true;
  if (config.cookieSecure === 'false') return false;
  return !!req.secure;
}
function setCookie(req, res, value, maxAgeSeconds) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (isSecure(req)) parts.push('Secure');
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  res.append('Set-Cookie', parts.join('; '));
}

/* ------------------------------------------------------------------ sessions */
function sessionCap(createdAt, remember) {
  const created = new Date(createdAt).getTime();
  return new Date(created + (remember ? config.session.rememberDays * 864e5 : config.session.maxHours * 36e5));
}
function nextExpiry(createdAt, remember) {
  const idle = new Date(Date.now() + config.session.idleMinutes * 6e4);
  const cap = sessionCap(createdAt, remember);
  return idle < cap ? idle : cap;
}

async function createSession(req, res, user, remember) {
  const raw = token();
  const now = new Date();
  const expires = nextExpiry(now, remember);
  const csrf = token();
  await db.query(
    'INSERT INTO sessions (id_hash, user_id, csrf_token, remember, created_at, last_seen_at, expires_at, user_agent) VALUES ($1,$2,$3,$4,$5,$5,$6,$7)',
    [sha256(raw), user.id, csrf, !!remember, now, expires, String(req.get('user-agent') || '').slice(0, 200)]
  );
  setCookie(req, res, raw, remember ? config.session.rememberDays * 86400 : undefined);
  return csrf;
}

async function revokeUserSessions(userId, exceptHash) {
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND ($2::text IS NULL OR id_hash <> $2)', [userId, exceptHash || null]);
}

/** Middleware: attaches req.user / req.session when a valid session cookie is present. */
async function loadSession(req, res, next) {
  try {
    const raw = parseCookies(req.headers.cookie)[COOKIE];
    if (!raw || raw.length > 100) return next();
    const idHash = sha256(raw);
    const r = await db.query(
      `SELECT s.id_hash, s.csrf_token, s.remember, s.created_at, s.last_seen_at, s.expires_at,
              u.id, u.username, u.full_name, u.email, u.role, u.is_active, u.must_change_password, u.preferences
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = $1`, [idHash]);
    const row = r.rows[0];
    if (!row) return next();
    if (new Date(row.expires_at) <= new Date() || !row.is_active) {
      await db.query('DELETE FROM sessions WHERE id_hash = $1', [idHash]);
      req.sessionExpired = true;
      return next();
    }
    req.session = { idHash, csrf: row.csrf_token, remember: row.remember };
    req.user = { id: row.id, username: row.username, full_name: row.full_name, email: row.email, role: row.role,
      must_change_password: row.must_change_password, preferences: row.preferences || {} };
    // Sliding expiry, written at most once per minute.
    if (Date.now() - new Date(row.last_seen_at).getTime() > 60000) {
      db.query('UPDATE sessions SET last_seen_at = now(), expires_at = $2 WHERE id_hash = $1',
        [idHash, nextExpiry(row.created_at, row.remember)]).catch(() => {});
    }
    next();
  } catch (err) { next(err); }
}

/** Middleware for /api: require login, CSRF token on writes, and a changed initial password. */
function requireAuth(req, res, next) {
  if (!req.user) {
    const e = unauthorized(req.sessionExpired ? 'Your session has expired.' : undefined);
    if (req.sessionExpired) e.code = 'session_expired';
    return next(e);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const sent = req.get('x-csrf-token') || '';
    const ok = sent.length === req.session.csrf.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.session.csrf));
    if (!ok) { const e = forbidden('Security token missing or invalid. Please reload the page.'); e.code = 'csrf'; return next(e); }
  }
  if (req.user.must_change_password && !req.allowWithPasswordChange) {
    const e = forbidden('Please change your password first.'); e.code = 'password_change_required'; return next(e);
  }
  next();
}

/** Rejects cross-site requests by comparing Origin with Host (defence in depth next to SameSite + CSRF token). */
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.get('host')) return next(forbidden('Cross-site request blocked.'));
  } catch (e) { return next(forbidden('Cross-site request blocked.')); }
  next();
}

/* ------------------------------------------------------------------ rate limiting */
const attempts = new Map(); // key -> [timestamps]
const WINDOW = 15 * 60 * 1000;
function tooManyAttempts(key, limit) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < WINDOW);
  attempts.set(key, list);
  return list.length >= limit;
}
function recordFailure(key) { const l = attempts.get(key) || []; l.push(Date.now()); attempts.set(key, l); }
setInterval(() => { const now = Date.now(); for (const [k, l] of attempts) if (!l.some((t) => now - t < WINDOW)) attempts.delete(k); }, 5 * 60 * 1000).unref();

/* ------------------------------------------------------------------ public user shape */
function publicUser(u) {
  return { id: u.id, username: u.username, fullName: u.full_name, email: u.email || '', role: u.role,
    mustChangePassword: !!u.must_change_password, permissions: permissionsFor(u.role), preferences: u.preferences || {} };
}

/* ------------------------------------------------------------------ routes */
const router = express.Router();

router.post('/login', sameOrigin, wrap(async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim().toLowerCase().slice(0, 120);
  const password = String((req.body && req.body.password) || '');
  const remember = !!(req.body && req.body.remember);
  if (!username || !password) throw badRequest('Please enter username and password.');
  const ip = audit.clientIp(req) || 'unknown';
  if (tooManyAttempts('u:' + username, 5) || tooManyAttempts('ip:' + ip, 25)) {
    log.warn('Login blocked by rate limit', { username, ip });
    throw tooMany('Too many failed sign-in attempts. Please wait 15 minutes and try again.');
  }
  const r = await db.query('SELECT * FROM users WHERE lower(username) = $1 OR (email <> \'\' AND lower(email) = $1) LIMIT 1', [username]);
  const user = r.rows[0];
  const valid = user ? await passwords.verify(user.password_hash, password) : await passwords.dummyVerify(password);
  if (!user || !valid || !user.is_active) {
    recordFailure('u:' + username); recordFailure('ip:' + ip);
    log.warn('Login failed', { username, ip, reason: !user ? 'unknown_user' : !valid ? 'wrong_password' : 'inactive' });
    await audit.write(null, req, { action: 'auth.login_failed', entityType: 'user', entityId: user ? user.id : null, summary: `Failed sign-in for "${username}"` });
    const e = unauthorized('Username or password is incorrect.'); e.code = 'invalid_credentials'; throw e;
  }
  attempts.delete('u:' + username);
  const csrf = await createSession(req, res, user, remember);
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  req.user = user;
  await audit.write(null, req, { action: 'auth.login', entityType: 'user', entityId: user.id, summary: `${user.full_name} signed in` });
  log.info('Login', { user: user.username });
  res.json({ user: publicUser(user), csrfToken: csrf });
}));

router.post('/logout', wrap(async (req, res) => {
  if (req.session) {
    await db.query('DELETE FROM sessions WHERE id_hash = $1', [req.session.idHash]);
    await audit.write(null, req, { action: 'auth.logout', entityType: 'user', entityId: req.user.id, summary: `${req.user.full_name} signed out` });
  }
  setCookie(req, res, '', 0);
  res.json({ ok: true });
}));

router.get('/me', (req, res, next) => {
  if (!req.user) {
    const e = unauthorized(req.sessionExpired ? 'Your session has expired.' : undefined);
    if (req.sessionExpired) e.code = 'session_expired';
    return next(e);
  }
  res.json({ user: publicUser(req.user), csrfToken: req.session.csrf, version: config.version });
});

router.post('/password', (req, res, next) => { req.allowWithPasswordChange = true; next(); }, requireAuth, wrap(async (req, res) => {
  const current = String((req.body && req.body.currentPassword) || '');
  const next = String((req.body && req.body.newPassword) || '');
  const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!r.rows[0] || !(await passwords.verify(r.rows[0].password_hash, current))) throw badRequest('The current password is incorrect.');
  const policy = passwords.policyError(next, req.user.username);
  if (policy) throw badRequest(policy);
  if (next === current) throw badRequest('The new password must be different from the current password.');
  await db.query('UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = now(), updated_at = now() WHERE id = $1',
    [req.user.id, await passwords.hash(next)]);
  await revokeUserSessions(req.user.id, req.session.idHash);
  await audit.write(null, req, { action: 'user.password_changed', entityType: 'user', entityId: req.user.id, summary: `${req.user.full_name} changed their password` });
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------ bootstrap */
async function ensureInitialAdmin() {
  const count = (await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
  if (count > 0) return;
  const a = config.initialAdmin;
  if (!a.username || !a.password) {
    log.warn('No users exist yet. Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD in .env and restart, or run: docker compose exec app node src/cli.js create-admin');
    return;
  }
  const username = a.username.trim().toLowerCase();
  const policy = passwords.policyError(a.password, username);
  if (policy) { log.error('INITIAL_ADMIN_PASSWORD rejected: ' + policy + ' – no administrator created.'); return; }
  await db.query(
    `INSERT INTO users (username, email, full_name, role, password_hash, must_change_password) VALUES ($1,$2,$3,'admin',$4,true)`,
    [username, a.email || null, a.fullName || 'Administrator', await passwords.hash(a.password)]);
  await audit.write(null, null, { action: 'user.created', entityType: 'user', summary: `Initial administrator "${username}" created from environment`, actorName: 'System' });
  log.info('Initial administrator created – the password must be changed at first sign-in. You can now remove INITIAL_ADMIN_PASSWORD from .env.', { username });
}

async function cleanupSessions() {
  await db.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
}

module.exports = { router, loadSession, requireAuth, sameOrigin, revokeUserSessions, ensureInitialAdmin, cleanupSessions, publicUser, COOKIE };
