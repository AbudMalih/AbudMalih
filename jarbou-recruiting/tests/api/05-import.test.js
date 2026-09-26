'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { admin } = require('./helpers');

test('offline backup import: preview detects duplicates, commit imports only new candidates', async () => {
  const A = await admin();
  const legacy = {
    app: 'jarbou-recruiting', schemaVersion: 1, exportedAt: '2026-09-20T10:00:00Z',
    meta: { settings: { documents: [{ key: 'custom_fahrerkarte', label: 'Fahrerkarte', required: true, expiry: true }], onboardingSteps: [] } },
    candidates: [
      { id: 'JRB-0001', firstName: 'Riber', lastName: 'Isso', stage: 'documents', project: 'DHL Express' },
      { id: 'JRB-0077', firstName: 'Legacy', lastName: 'Import ' + Date.now().toString(36), phone: '+49 151 2345678', station: 'Leipzig Test', project: 'DHL Express',
        position: 'Driver', source: 'Recommendation', stage: 'interview', startDate: '2026-11-15',
        documents: { fuehrungszeugnis: { status: 'received', issueDate: '', expiryDate: '', note: '' }, custom_fahrerkarte: { status: 'requested' } },
        contract: { status: 'preparing', type: 'Vollzeit' }, onboarding: { workwear: { done: true, date: '2026-09-10' } },
        activities: [{ id: 'x1', type: 'call', date: '2026-09-10T09:00:00.000Z', text: 'Old phone call' }], noteLog: [{ id: 'n1', date: '2026-09-11T09:00:00.000Z', text: 'Old note' }] }
    ]
  };
  const p = await A.post('/api/import/legacy/preview', legacy);
  assert.equal(p.status, 200);
  assert.equal(p.data.total, 2);
  assert.equal(p.data.duplicates, 1);
  assert.ok(p.data.createLists.stations.includes('Leipzig Test'));
  assert.deepEqual(p.data.newDocuments, ['Fahrerkarte']);
  const before = (await A.get('/api/candidates')).data.items.length;
  const c = await A.post('/api/import/legacy/commit', { token: p.data.token, includeDuplicates: false });
  assert.equal(c.status, 200);
  assert.equal(c.data.imported, 1);
  assert.equal(c.data.skipped, 1);
  const list = (await A.get('/api/candidates')).data.items;
  assert.equal(list.length, before + 1);
  const imp = list.find((x) => x.lastName === legacy.candidates[1].lastName);
  assert.equal(imp.station, 'Leipzig Test');
  assert.equal(imp.source, 'Referral');
  assert.equal(imp.documents.fuehrungszeugnis.status, 'received');
  assert.equal(imp.documents.custom_fahrerkarte.status, 'requested');
  assert.equal(imp.contract.status, 'preparing');
  const full = (await A.get('/api/candidates/' + imp.id)).data;
  assert.ok(full.activities.some((a) => a.text === 'Old phone call'));
  assert.ok(full.noteLog.some((n) => n.text === 'Old note'));
  const riber = list.filter((x) => x.firstName === 'Riber' && x.lastName === 'Isso');
  assert.equal(riber.length, 1, 'duplicate was not imported');
  const audit = await A.get('/api/audit?action=import.legacy');
  assert.ok(audit.data.items.length >= 1);
  assert.equal((await A.post('/api/import/legacy/commit', { token: p.data.token })).status, 404, 'token cannot be reused');
  assert.equal((await A.post('/api/import/legacy/preview', { hello: 'world' })).status, 400);
});
