'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { admin, userClient, newCandidate } = require('./helpers');

let A, R, V, cand;
test.before(async () => {
  A = await admin();
  const s = Date.now().toString(36);
  R = await userClient(A, 'recruiter', 'r' + s);
  V = await userClient(A, 'viewer', 'v' + s);
  cand = await newCandidate(A);
});

test('viewer can read but not modify anything (403)', async () => {
  assert.equal((await V.get('/api/candidates')).status, 200);
  assert.equal((await V.get('/api/candidates/' + cand.id)).status, 200);
  assert.equal((await V.get('/api/settings')).status, 200);
  assert.equal((await V.get('/api/activity/recent')).status, 200);
  assert.equal((await V.post('/api/candidates', { firstName: 'X', lastName: 'Y' })).status, 403);
  assert.equal((await V.patch('/api/candidates/' + cand.id, { changes: [{ path: 'phone', from: '', to: '123' }] })).status, 403);
  assert.equal((await V.post('/api/candidates/' + cand.id + '/follow-ups', { date: '2026-12-01' })).status, 403);
  assert.equal((await V.put('/api/settings', { companyName: 'X' })).status, 403);
  assert.equal((await V.get('/api/users')).status, 403);
  assert.equal((await V.get('/api/audit')).status, 403);
  assert.equal((await V.get('/api/backups')).status, 403);
  assert.equal((await V.del('/api/candidates/' + cand.id)).status, 403);
});

test('recruiter manages candidates but not users, settings, backups, audit or deletion', async () => {
  const c = await newCandidate(R);
  assert.equal(c.createdBy, R.user.fullName);
  const p = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'documents.fuehrungszeugnis.status', from: 'missing', to: 'received' }] });
  assert.equal(p.status, 200);
  assert.equal(p.data.documents.fuehrungszeugnis.status, 'received');
  const arch = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'archived', from: false, to: true }, { path: 'archiveReason', from: '', to: 'Duplicate' }] });
  assert.equal(arch.status, 200);
  assert.equal((await R.del('/api/candidates/' + c.id)).status, 403);
  assert.equal((await R.get('/api/users')).status, 403);
  assert.equal((await R.post('/api/users', { username: 'hack', fullName: 'H', role: 'admin', password: 'Hack-Pass-12345' })).status, 403);
  assert.equal((await R.put('/api/settings', { companyName: 'X' })).status, 403);
  assert.equal((await R.post('/api/settings/lists/stations', { name: 'Evil' })).status, 403);
  assert.equal((await R.get('/api/backups')).status, 403);
  assert.equal((await R.post('/api/backups')).status, 403);
  assert.equal((await R.post('/api/backups/x/restore', { confirm: 'RESTORE' })).status, 403);
  assert.equal((await R.get('/api/audit')).status, 403);
  assert.equal((await R.post('/api/import/legacy/preview', { app: 'jarbou-recruiting', candidates: [] })).status, 403);
  // admin may delete the archived candidate
  assert.equal((await A.del('/api/candidates/' + c.id)).status, 200);
});

test('admin can manage users, settings and see the audit log', async () => {
  assert.equal((await A.get('/api/users')).status, 200);
  assert.equal((await A.get('/api/audit')).status, 200);
  assert.equal((await A.get('/api/backups')).status, 200);
  const s = await A.post('/api/settings/lists/stations', { name: 'Göttingen ' + Date.now().toString(36) });
  assert.equal(s.status, 201);
});

test('the last active administrator cannot be removed', async () => {
  const users = (await A.get('/api/users')).data;
  const admins = users.filter((u) => u.role === 'admin' && u.active);
  if (admins.length === 1) {
    const r = await A.patch('/api/users/' + admins[0].id, { role: 'viewer' });
    assert.equal(r.status, 400);
  }
});

test('mass assignment is ignored: read-only fields cannot be set', async () => {
  const c = await newCandidate(R);
  const r = await R.patch('/api/candidates/' + c.id, { changes: [
    { path: 'createdBy', from: c.createdBy, to: 'Someone else' },
    { path: 'version', from: c.version, to: 999 },
    { path: 'id', from: c.id, to: 'JRB-9999' }
  ] });
  assert.equal(r.status, 200);
  assert.equal(r.data.createdBy, c.createdBy);
  assert.equal(r.data.id, c.id);
  assert.notEqual(r.data.version, 999);
  const bad = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'stage', from: 'new', to: 'hacked' }] });
  assert.equal(bad.status, 400);
  const sql = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'city', from: '', to: "Hannover'); DROP TABLE candidates;--" }] });
  assert.equal(sql.status, 200);
  assert.equal(sql.data.city, "Hannover'); DROP TABLE candidates;--");
  assert.equal((await A.get('/api/candidates/' + c.id)).status, 200);
});
