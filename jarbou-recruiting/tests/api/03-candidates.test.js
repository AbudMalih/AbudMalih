'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { admin, userClient, newCandidate } = require('./helpers');

let A, R;
test.before(async () => {
  A = await admin();
  R = await userClient(A, 'recruiter', 'c' + Date.now().toString(36));
});

test('initial candidates exist with the specified data and no invented personal data', async () => {
  const r = await A.get('/api/candidates');
  const riber = r.data.items.find((c) => c.firstName === 'Riber' && c.lastName === 'Isso');
  const abd = r.data.items.find((c) => c.firstName === 'Abdalrazaq' && c.lastName === 'Al Shaer');
  assert.ok(riber && abd);
  assert.equal(riber.employmentType, 'Teilzeit');
  assert.equal(riber.salaryReference, 2160);
  assert.equal(riber.salaryExpectationMin, 1000);
  assert.equal(abd.salaryExpectationMin, 700);
  assert.equal(abd.salaryExpectationMax, 800);
  assert.equal(riber.taxClass, 'Steuerklasse 1');
  assert.equal(riber.startDate, '2026-10-01');
  assert.equal(abd.startDate, '2026-11-01');
  assert.equal(riber.documents.fuehrungszeugnis.status, 'missing');
  assert.equal(riber.availability, 'ready');
  for (const c of [riber, abd]) { assert.equal(c.phone, ''); assert.equal(c.email, ''); assert.equal(c.address, ''); assert.equal(c.nationality, ''); assert.equal(c.dob, ''); }
});

test('create, edit, sync and audit trail with user names', async () => {
  const c = await newCandidate(R, { phone: '+49 170 1111111' });
  assert.match(c.id, /^[A-Z]+-\d{4,}$/);
  const r = await R.patch('/api/candidates/' + c.id, {
    changes: [{ path: 'startDate', from: '2026-12-01', to: '2026-12-03' }, { path: 'contract.status', from: 'not_started', to: 'sent' }, { path: 'onboarding.workwear.done', from: false, to: true }],
    addActivities: [{ type: 'call', date: new Date().toISOString(), text: 'Phone call completed' }]
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.startDate, '2026-12-03');
  assert.equal(r.data.contract.status, 'sent');
  assert.equal(r.data.onboarding.workwear.done, true);
  const act = r.data.activities.find((x) => x.text === 'Phone call completed');
  assert.ok(act && act.by === R.user.fullName);
  const audit = await A.get('/api/audit?candidate=' + c.id);
  const upd = audit.data.items.find((x) => x.action === 'candidate.updated');
  assert.equal(upd.actor_name, R.user.fullName);
  assert.ok(upd.changes.some((ch) => ch.field === 'startDate' && ch.from === '2026-12-01' && ch.to === '2026-12-03'));
  const since = new Date(Date.now() - 60000).toISOString();
  const delta = await A.get('/api/candidates?since=' + encodeURIComponent(since));
  assert.ok(delta.data.items.some((x) => x.id === c.id));
  assert.equal(delta.data.full, false);
});

test('conflict: a stale edit of the same field is rejected, nothing is overwritten', async () => {
  const c = await newCandidate(A);
  // User B saves first
  assert.equal((await A.patch('/api/candidates/' + c.id, { changes: [{ path: 'startDate', from: '2026-12-01', to: '2026-12-10' }] })).status, 200);
  // User A still has the old value 2026-12-01 and tries to set another date
  const stale = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'startDate', from: '2026-12-01', to: '2026-12-20' }, { path: 'phone', from: '', to: '0170 999' }] });
  assert.equal(stale.status, 409);
  assert.match(stale.data.message, /updated by another user/);
  const now = (await A.get('/api/candidates/' + c.id)).data;
  assert.equal(now.startDate, '2026-12-10');
  assert.equal(now.phone, ''); // atomic: nothing from the rejected save was applied
  // Different fields edited concurrently merge fine
  const other = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'phone', from: '', to: '0170 999' }] });
  assert.equal(other.status, 200);
  assert.equal(other.data.startDate, '2026-12-10');
  assert.equal(other.data.phone, '0170 999');
});

test('follow-ups: create with time and type, complete', async () => {
  const c = await newCandidate(R);
  const f = await R.post(`/api/candidates/${c.id}/follow-ups`, { date: '2026-10-05', time: '09:30', type: 'whatsapp', note: 'Ask for Führungszeugnis' });
  assert.equal(f.status, 201);
  assert.equal(f.data.followUpDate, '2026-10-05');
  assert.equal(f.data.followUpTime, '09:30');
  assert.equal(f.data.followUpType, 'whatsapp');
  const done = await R.post(`/api/candidates/${c.id}/follow-ups/${f.data.followUpId}/complete`, {});
  assert.equal(done.status, 200);
  assert.equal(done.data.followUpDate, '');
  assert.equal(done.data.followUps[0].status, 'done');
  assert.equal((await R.post(`/api/candidates/${c.id}/follow-ups`, { date: 'tomorrow' })).status, 400);
});

test('archive → restore → permanent delete (admin, archived only) with tombstone for sync', async () => {
  const c = await newCandidate(R);
  assert.equal((await A.del('/api/candidates/' + c.id)).status, 400); // not archived yet
  await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'archived', from: false, to: true }, { path: 'archiveReason', from: '', to: 'Rejected' }] });
  const restored = await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'archived', from: true, to: false }] });
  assert.equal(restored.data.archived, false);
  await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'archived', from: false, to: true }] });
  const since = new Date(Date.now() - 5000).toISOString();
  assert.equal((await A.del('/api/candidates/' + c.id)).status, 200);
  assert.equal((await A.get('/api/candidates/' + c.id)).status, 404);
  const delta = await A.get('/api/candidates?since=' + encodeURIComponent(since));
  assert.ok(delta.data.deleted.includes(c.id));
  const audit = await A.get('/api/audit?candidate=' + c.id);
  const actions = audit.data.items.map((x) => x.action);
  assert.ok(actions.includes('candidate.archived') && actions.includes('candidate.restored') && actions.includes('candidate.deleted'));
});

test('input validation', async () => {
  assert.equal((await R.post('/api/candidates', { firstName: '', lastName: 'X' })).status, 400);
  assert.equal((await R.post('/api/candidates', { firstName: 'A', lastName: 'B', station: 'Atlantis' })).status, 400);
  const c = await newCandidate(R);
  assert.equal((await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'startDate', from: '2026-12-01', to: '01.12.2026' }] })).status, 400);
  assert.equal((await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'documents.nope.status', from: null, to: 'missing' }] })).status, 400);
  assert.equal((await R.patch('/api/candidates/' + c.id, { changes: [{ path: 'hoursPerWeek', from: null, to: 500 }] })).status, 400);
  assert.equal((await R.get('/api/candidates/..%2F..%2Fetc')).status, 404);
});
