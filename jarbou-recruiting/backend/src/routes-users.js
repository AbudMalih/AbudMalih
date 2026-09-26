/* User management (admin only). Password hashes are never returned. */
'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const audit = require('./audit');
const events = require('./events');
const passwords = require('./passwords');
const { revokeUserSessions } = require('./auth');
const { requirePerm } = require('./rbac');
const { wrap, badRequest, notFound, conflict } = require('./errors');

const router = express.Router();
router.use(requirePerm('users.manage'));

const ROLES = ['admin', 'recruiter', 'viewer'];
const shape = (u) => ({ id: u.id, username: u.username, fullName: u.full_name, email: u.email || '', role: u.role, active: u.is_active,
  mustChangePassword: u.must_change_password, lastLoginAt: u.last_login_at, createdAt: u.created_at, activeSessions: Number(u.sessions || 0) });
const SELECT = `SELECT u.*, (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS sessions FROM users u`;

function validate(body, isNew) {
  const out = {};
  if (isNew || body.username !== undefined) {
    out.username = String(body.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(out.username)) throw badRequest('Username: 3–40 characters, only letters, numbers, dot, dash, underscore.');
  }
  if (isNew || body.fullName !== undefined) {
    out.full_name = String(body.fullName || '').trim();
    if (!out.full_name || out.full_name.length > 120) throw badRequest('Please enter the full name.');
  }
  if (body.email !== undefined) {
    out.email = String(body.email || '').trim();
    if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw badRequest('Please enter a valid email address.');
    if (out.email.length > 160) throw badRequest('Email is too long.');
  }
  if (isNew || body.role !== undefined) {
    if (!ROLES.includes(body.role)) throw badRequest('Please choose a role.');
    out.role = body.role;
  }
  return out;
}

async function activeAdmins(q, exceptId) {
  return (await q.query("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND is_active AND id <> $1", [exceptId])).rows[0].n;
}

router.get('/', wrap(async (req, res) => {
  res.json((await db.query(SELECT + ' ORDER BY u.is_active DESC, u.full_name')).rows.map(shape));
}));

router.post('/', wrap(async (req, res) => {
  const body = req.body || {};
  const v = validate(body, true);
  const pw = String(body.password || '');
  const policy = passwords.policyError(pw, v.username);
  if (policy) throw badRequest(policy);
  const id = await db.tx(async (q) => {
    const dup = await q.query('SELECT 1 FROM users WHERE lower(username) = $1 OR ($2 <> \'\' AND lower(email) = lower($2))', [v.username, v.email || '']);
    if (dup.rows.length) throw conflict('A user with this username or email already exists.');
    const r = await q.query('INSERT INTO users (username, email, full_name, role, password_hash, must_change_password, created_by) VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING id',
      [v.username, v.email || null, v.full_name, v.role, await passwords.hash(pw), req.user.id]);
    await audit.write(q, req, { action: 'user.created', entityType: 'user', entityId: r.rows[0].id, summary: `User created: ${v.full_name} (${v.username}, ${v.role})` });
    return r.rows[0].id;
  });
  events.publish('settings', { what: 'users' });
  res.status(201).json(shape((await db.query(SELECT + ' WHERE u.id = $1', [id])).rows[0]));
}));

router.patch('/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  const body = req.body || {};
  const v = validate(body, false);
  await db.tx(async (q) => {
    const cur = (await q.query('SELECT * FROM users WHERE id::text = $1 FOR UPDATE', [id])).rows[0];
    if (!cur) throw notFound('User not found.');
    const changes = [];
    if (v.username && v.username !== cur.username) {
      if ((await q.query('SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2', [v.username, cur.id])).rows.length) throw conflict('This username is already taken.');
    }
    const demote = (v.role && v.role !== 'admin' && cur.role === 'admin') || (body.active === false && cur.role === 'admin');
    if (demote && cur.is_active && (await activeAdmins(q, cur.id)) === 0) throw badRequest('At least one active administrator must remain.');
    const sets = []; const params = [cur.id];
    for (const [col, val] of Object.entries(v)) {
      if ((cur[col] || '') !== (val || '')) { params.push(val === '' && col === 'email' ? null : val); sets.push(`${col} = $${params.length}`); changes.push({ field: col, from: cur[col], to: val }); }
    }
    if (body.active !== undefined && !!body.active !== cur.is_active) {
      params.push(!!body.active); sets.push(`is_active = $${params.length}`); changes.push({ field: 'active', from: cur.is_active, to: !!body.active });
    }
    if (!sets.length) return;
    await q.query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
    const action = body.active === false && cur.is_active ? 'user.deactivated' : body.active === true && !cur.is_active ? 'user.reactivated' : 'user.updated';
    await audit.write(q, req, { action, entityType: 'user', entityId: cur.id, summary: `${cur.full_name} (${cur.username})`, changes });
    if (body.active === false || (v.role && v.role !== cur.role)) {
      await q.query('DELETE FROM sessions WHERE user_id = $1', [cur.id]);
    }
  });
  if (body.active === false) events.disconnectUser(id);
  events.publish('settings', { what: 'users' });
  res.json(shape((await db.query(SELECT + ' WHERE u.id::text = $1', [id])).rows[0]));
}));

/* Admin sets a temporary password (user must change it at next sign-in). */
router.post('/:id/reset-password', wrap(async (req, res) => {
  const id = String(req.params.id);
  const cur = (await db.query('SELECT id, username, full_name FROM users WHERE id::text = $1', [id])).rows[0];
  if (!cur) throw notFound('User not found.');
  let pw = String((req.body && req.body.password) || '');
  let generated = false;
  if (!pw) { pw = crypto.randomBytes(9).toString('base64url') + '7a'; generated = true; }
  const policy = passwords.policyError(pw, cur.username);
  if (policy) throw badRequest(policy);
  await db.query('UPDATE users SET password_hash = $2, must_change_password = true, password_changed_at = now(), updated_at = now() WHERE id = $1', [cur.id, await passwords.hash(pw)]);
  await revokeUserSessions(cur.id);
  events.disconnectUser(cur.id);
  await audit.write(null, req, { action: 'user.password_reset', entityType: 'user', entityId: cur.id, summary: `Password reset for ${cur.full_name} (${cur.username})` });
  res.json({ ok: true, temporaryPassword: generated ? pw : undefined });
}));

router.post('/:id/revoke-sessions', wrap(async (req, res) => {
  const id = String(req.params.id);
  const cur = (await db.query('SELECT id, username, full_name FROM users WHERE id::text = $1', [id])).rows[0];
  if (!cur) throw notFound('User not found.');
  await revokeUserSessions(cur.id, cur.id === req.user.id ? req.session.idHash : null);
  events.disconnectUser(cur.id);
  await audit.write(null, req, { action: 'user.sessions_revoked', entityType: 'user', entityId: cur.id, summary: `All sessions revoked for ${cur.full_name} (${cur.username})` });
  res.json({ ok: true });
}));

module.exports = router;
