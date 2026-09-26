'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, admin, userClient, newCandidate } = require('./helpers');

let A, R, V, cand;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d0a6b30000000049454e44ae426082', 'hex');

function form(buf, name, type, docKey) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: type || 'application/octet-stream' }), name);
  if (docKey) fd.append('docKey', docKey);
  return fd;
}

test.before(async () => {
  A = await admin();
  const s = Date.now().toString(36);
  R = await userClient(A, 'recruiter', 'a' + s);
  V = await userClient(A, 'viewer', 'a' + s);
  cand = await newCandidate(R);
});

test('upload a PDF for a document, download it with authorization', async () => {
  const up = await R.post(`/api/candidates/${cand.id}/attachments`, form(PDF, 'führungszeugnis.pdf', 'application/pdf', 'fuehrungszeugnis'));
  assert.equal(up.status, 201);
  const att = up.data.attachments[0];
  assert.equal(att.docKey, 'fuehrungszeugnis');
  assert.equal(att.mime, 'application/pdf');
  assert.equal(att.name, 'führungszeugnis.pdf');
  assert.ok(!JSON.stringify(up.data).includes('/data/uploads'), 'no raw filesystem path exposed');
  const dl = await R.get('/api/attachments/' + att.id);
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('content-type'), 'application/pdf');
  assert.match(dl.headers.get('content-disposition'), /attachment/);
  assert.equal(dl.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(Buffer.compare(dl.data, PDF) === 0);
  // not signed in → 401, viewer → 403
  assert.equal((await new Client().get('/api/attachments/' + att.id)).status, 401);
  assert.equal((await V.get('/api/attachments/' + att.id)).status, 403);
  // uploads directory is not publicly served
  for (const p of ['/uploads/2026/x.pdf', '/data/uploads/2026/x.pdf', '/backups/x.tar.gz']) assert.equal((await new Client().get(p)).status, 404, p);
  const shell = await new Client().get('/uploads/');
  assert.ok(!String(shell.data).includes('Index of'), 'no directory listing');
  const png = await R.post(`/api/candidates/${cand.id}/attachments`, form(PNG, 'licence.png', 'image/png', 'licence'));
  assert.equal(png.status, 201);
  const del = await R.del('/api/attachments/' + att.id);
  assert.equal(del.status, 200);
  assert.equal((await R.get('/api/attachments/' + att.id)).status, 404);
});

test('dangerous or disguised files are rejected', async () => {
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]);
  assert.equal((await R.post(`/api/candidates/${cand.id}/attachments`, form(exe, 'setup.exe'))).status, 400);
  assert.equal((await R.post(`/api/candidates/${cand.id}/attachments`, form(exe, 'invoice.pdf', 'application/pdf'))).status, 400);
  assert.equal((await R.post(`/api/candidates/${cand.id}/attachments`, form(Buffer.from('<script>alert(1)</script>'), 'x.html', 'text/html'))).status, 400);
  assert.equal((await R.post(`/api/candidates/${cand.id}/attachments`, form(Buffer.from('<svg onload=alert(1)>'), 'x.svg', 'image/svg+xml'))).status, 400);
  // path traversal in the original name is neutralised
  const t = await R.post(`/api/candidates/${cand.id}/attachments`, form(PDF, '../../../etc/passwd.pdf', 'application/pdf'));
  assert.equal(t.status, 201);
  assert.equal(t.data.attachments[0].name, 'passwd.pdf');
  // viewers cannot upload
  assert.equal((await V.post(`/api/candidates/${cand.id}/attachments`, form(PDF, 'a.pdf', 'application/pdf'))).status, 403);
  // unknown / traversal ids
  assert.equal((await R.get('/api/attachments/..%2F..%2Fetc%2Fpasswd')).status, 404);
});

test('oversized uploads are rejected', async () => {
  const big = Buffer.concat([PDF, Buffer.alloc(16 * 1024 * 1024)]);
  const r = await R.post(`/api/candidates/${cand.id}/attachments`, form(big, 'big.pdf', 'application/pdf'));
  assert.equal(r.status, 400);
});
