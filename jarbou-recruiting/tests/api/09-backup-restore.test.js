'use strict';
/* DESTRUCTIVE: restores the database. Runs last and only against the isolated test stack. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { admin, newCandidate } = require('./helpers');

test('backup → modify → restore brings the original data back and signs everyone out', async () => {
  let A = await admin();
  const keep = await newCandidate(A, { lastName: 'BackupKeep' });
  const b = await A.post('/api/backups');
  assert.equal(b.status, 201);
  assert.match(b.data.name, /^jarbou-recruiting_\d{4}-\d{2}-\d{2}_\d{6}_manual\.tar\.gz$/);
  const list = await A.get('/api/backups');
  assert.ok(list.data.files.some((f) => f.name === b.data.name));
  assert.equal(list.data.lastStatus, 'success');
  assert.ok(list.data.nextScheduled);
  const man = await A.get('/api/backups/' + b.data.name + '/manifest');
  assert.equal(man.data.app, 'jarbou-recruiting');
  // modify data after the backup
  await A.patch('/api/candidates/' + keep.id, { changes: [{ path: 'startDate', from: '2026-12-01', to: '2027-01-15' }] });
  const extra = await newCandidate(A, { lastName: 'AfterBackup' });
  // restore requires explicit confirmation
  assert.equal((await A.post('/api/backups/' + b.data.name + '/restore', {})).status, 400);
  const r = await A.post('/api/backups/' + b.data.name + '/restore', { confirm: 'RESTORE' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.safetyBackup, /pre-restore/);
  // everybody is signed out
  assert.equal((await A.get('/api/candidates')).status, 401);
  A = await admin();
  const kept = (await A.get('/api/candidates/' + keep.id)).data;
  assert.equal(kept.startDate, '2026-12-01');
  assert.equal((await A.get('/api/candidates/' + extra.id)).status, 404);
  const audit = await A.get('/api/audit?action=backup.restored');
  assert.ok(audit.data.items.length >= 1);
  assert.equal((await A.post('/api/backups/..%2F..%2Fetc%2Fpasswd/restore', { confirm: 'RESTORE' })).status, 404);
});
