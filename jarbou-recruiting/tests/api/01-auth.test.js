'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, admin, userClient, ADMIN_USER } = require('./helpers');

test('health endpoint reports app + database without secrets', async () => {
  const r = await new Client().get('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data).sort(), ['database', 'status', 'version']);
  assert.equal(r.data.database, 'ok');
});

test('API requires authentication (401)', async () => {
  const c = new Client();
  for (const p of ['/api/candidates', '/api/settings', '/api/users', '/api/audit', '/api/backups', '/api/auth/me']) {
    assert.equal((await c.get(p)).status, 401, p);
  }
});

test('wrong password is rejected without revealing whether the user exists', async () => {
  const c = new Client();
  const a = await c.login(ADMIN_USER, 'definitely-wrong-1');
  const b = await c.login('no.such.user', 'definitely-wrong-1');
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.data.message, b.data.message);
});

test('session cookie is HttpOnly + SameSite=Strict, logout ends the session', async () => {
  const c = await admin();
  assert.match(c.lastSetCookie, /HttpOnly/);
  assert.match(c.lastSetCookie, /SameSite=Strict/);
  const me = await c.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user.passwordHash, undefined);
  assert.ok(!JSON.stringify(me.data).includes('argon2'));
  const saved = c.cookie;
  assert.equal((await c.post('/api/auth/logout')).status, 200);
  c.cookie = saved; // replaying the old cookie must not work
  assert.equal((await c.get('/api/auth/me')).status, 401);
});

test('state-changing requests without CSRF token are refused (403)', async () => {
  const c = await admin();
  const r = await c.post('/api/candidates', { firstName: 'A', lastName: 'B' }, { noCsrf: true });
  assert.equal(r.status, 403);
  assert.equal(r.data.error, 'csrf');
  const x = await c.post('/api/candidates', { firstName: 'A', lastName: 'B' }, { headers: { Origin: 'https://evil.example' } });
  assert.equal(x.status, 403);
});

test('new users must change their initial password; weak passwords rejected', async () => {
  const a = await admin();
  const username = 'test.pw.' + Date.now().toString(36);
  const weak = await a.post('/api/users', { username, fullName: 'PW Test', role: 'viewer', password: 'short' });
  assert.equal(weak.status, 400);
  const r = await a.post('/api/users', { username, fullName: 'PW Test', role: 'viewer', password: 'Initial-Pass-2026' });
  assert.equal(r.status, 201);
  assert.equal(r.data.mustChangePassword, true);
  const c = new Client();
  assert.equal((await c.login(username, 'Initial-Pass-2026')).status, 200);
  const blocked = await c.get('/api/candidates');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.error, 'password_change_required');
  assert.equal((await c.post('/api/auth/password', { currentPassword: 'Initial-Pass-2026', newPassword: 'Personal-Pass-2026' })).status, 200);
  assert.equal((await c.get('/api/candidates')).status, 200);
});

test('deactivated users are signed out immediately and cannot sign in', async () => {
  const a = await admin();
  const v = await userClient(a, 'viewer', 'deact' + Date.now().toString(36));
  assert.equal((await v.get('/api/candidates')).status, 200);
  assert.equal((await a.patch('/api/users/' + v.user.id, { active: false })).status, 200);
  assert.equal((await v.get('/api/candidates')).status, 401);
  assert.equal((await new Client().login(v.username, v.password)).status, 401);
  const audit = await a.get('/api/audit?action=user.deactivated&limit=10');
  assert.ok(audit.data.items.some((x) => x.entity_id === v.user.id));
});

test('login is rate limited after repeated failures (429)', async () => {
  const c = new Client();
  const u = 'ratelimit.' + Date.now().toString(36);
  let last;
  for (let i = 0; i < 7; i++) last = await c.login(u, 'wrong-password-' + i);
  assert.equal(last.status, 429);
});
