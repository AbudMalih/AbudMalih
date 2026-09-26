/* Candidate document attachments.
   - Files live in UPLOAD_DIR (persistent NAS folder), never under the public web root.
   - Server-generated file names; the original name is only stored as metadata.
   - Type is verified from the file's content (magic bytes), not from the name or browser.
   - Every download requires a session with the attachment.read permission. */
'use strict';
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');
const audit = require('./audit');
const events = require('./events');
const log = require('./logger');
const model = require('./candidate-model');
const { requirePerm } = require('./rbac');
const { wrap, badRequest, notFound, HttpError } = require('./errors');

const TYPES = [
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.slice(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  { mime: 'image/heic', ext: 'heic', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|mif1|msf1)$/.test(b.slice(8, 12).toString('latin1')) },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', zip: 'word/' },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', zip: 'xl/' }
];

function detectType(buf, originalName) {
  const ext = path.extname(originalName || '').slice(1).toLowerCase();
  for (const t of TYPES) {
    if (t.test && t.test(buf)) return t;
    if (t.zip && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04 && ext === t.ext) {
      // Office Open XML: a zip containing word/ or xl/ entries – and never macro-enabled formats.
      const head = buf.slice(0, Math.min(buf.length, 200000)).toString('latin1');
      if (head.includes(t.zip) && !head.includes('vbaProject.bin')) return t;
    }
  }
  return null;
}

function safeOriginalName(name) {
  const base = path.basename(String(name || 'document')).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
  return (base || 'document').slice(0, 150);
}

function storedPath(storedName) {
  if (!/^[0-9]{4}\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(storedName)) throw notFound();
  const full = path.resolve(config.paths.uploads, storedName);
  if (!full.startsWith(path.resolve(config.paths.uploads) + path.sep)) throw notFound(); // path traversal guard
  return full;
}

function removeFiles(names) {
  for (const n of names || []) { try { fs.unlinkSync(storedPath(n)); } catch (e) { /* already gone */ } }
}

const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8', // keep umlauts/Arabic in original file names
  limits: { fileSize: config.uploads.maxMb * 1024 * 1024, files: 1, fields: 5 }
});

const router = express.Router();

function enabled(req, res, next) {
  if (!config.uploads.enabled) return next(new HttpError(404, 'uploads_disabled', 'Document uploads are disabled on this server.'));
  next();
}

router.post('/candidates/:id/attachments', enabled, requirePerm('attachment.write'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return next(badRequest(`The file is too large (maximum ${config.uploads.maxMb} MB).`));
    if (err) return next(badRequest('Upload failed.'));
    next();
  });
}, wrap(async (req, res) => {
  const id = String(req.params.id);
  if (!req.file || !req.file.buffer || !req.file.size) throw badRequest('Please choose a file.');
  const original = safeOriginalName(req.file.originalname);
  const type = detectType(req.file.buffer, original);
  if (!type) throw badRequest('This file type is not allowed. Allowed: PDF, JPG, PNG, WEBP, HEIC, DOCX, XLSX.');
  const docKey = req.body && req.body.docKey ? String(req.body.docKey).slice(0, 60) : null;
  const year = String(new Date().getFullYear());
  const storedName = `${year}/${crypto.randomUUID()}.${type.ext}`;
  const full = storedPath(storedName);
  fs.mkdirSync(path.dirname(full), { recursive: true, mode: 0o750 });
  fs.writeFileSync(full, req.file.buffer, { mode: 0o640, flag: 'wx' });
  const sha = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  try {
    await db.tx(async (q) => {
      const c = (await q.query('SELECT first_name, last_name FROM candidates WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!c) throw notFound('Candidate not found.');
      if (docKey && !(await q.query('SELECT 1 FROM document_types WHERE key = $1', [docKey])).rows.length) throw badRequest('Unknown document.');
      await q.query('INSERT INTO attachments (candidate_id, doc_key, original_name, stored_name, mime_type, size_bytes, sha256, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, docKey, original, storedName, type.mime, req.file.size, sha, req.user.id]);
      await model.addActivities(q, id, [{ type: 'document', text: (req.body && req.body.activityText ? String(req.body.activityText).slice(0, 300) : 'File uploaded: ' + original) }], req.user);
      await model.touch(q, id, req.user);
      await audit.write(q, req, { action: 'attachment.uploaded', entityType: 'attachment', entityId: storedName, candidateId: id,
        summary: `${c.first_name} ${c.last_name}: file uploaded (${docKey || 'general'})`, changes: [{ field: 'file', from: null, to: `${original} (${Math.round(req.file.size / 1024)} KB)` }] });
    });
  } catch (err) {
    removeFiles([storedName]);
    throw err;
  }
  log.info('Attachment uploaded', { candidate: id, size: req.file.size, type: type.ext });
  events.publish('candidates', { ids: [id] });
  res.status(201).json(await model.get(id));
}));

router.get('/attachments/:aid', enabled, requirePerm('attachment.read'), wrap(async (req, res) => {
  const r = await db.query('SELECT a.*, c.first_name, c.last_name FROM attachments a JOIN candidates c ON c.id = a.candidate_id WHERE a.id::text = $1', [String(req.params.aid)]);
  const a = r.rows[0];
  if (!a) throw notFound('File not found.');
  const full = storedPath(a.stored_name);
  if (!fs.existsSync(full)) throw notFound('The file is missing on the server.');
  await audit.write(null, req, { action: 'attachment.downloaded', entityType: 'attachment', entityId: a.id, candidateId: a.candidate_id, summary: `${a.first_name} ${a.last_name}: ${a.original_name}` });
  const inline = req.query.inline === '1' && /^(application\/pdf|image\/(jpeg|png|webp))$/.test(a.mime_type);
  res.set({
    'Content-Type': a.mime_type,
    'Content-Length': String(a.size_bytes),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${a.original_name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(a.original_name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, no-store'
  });
  fs.createReadStream(full).pipe(res);
}));

router.delete('/attachments/:aid', enabled, requirePerm('attachment.write'), wrap(async (req, res) => {
  const a = await db.tx(async (q) => {
    const r = await q.query('SELECT a.*, c.first_name, c.last_name FROM attachments a JOIN candidates c ON c.id = a.candidate_id WHERE a.id::text = $1 FOR UPDATE', [String(req.params.aid)]);
    const row = r.rows[0];
    if (!row) throw notFound('File not found.');
    await q.query('DELETE FROM attachments WHERE id = $1', [row.id]);
    await model.addActivities(q, row.candidate_id, [{ type: 'document', text: (req.body && req.body.activityText ? String(req.body.activityText).slice(0, 300) : 'File deleted: ' + row.original_name) }], req.user);
    await model.touch(q, row.candidate_id, req.user);
    await audit.write(q, req, { action: 'attachment.deleted', entityType: 'attachment', entityId: row.id, candidateId: row.candidate_id,
      summary: `${row.first_name} ${row.last_name}: file deleted`, changes: [{ field: 'file', from: row.original_name, to: null }] });
    return row;
  });
  removeFiles([a.stored_name]);
  events.publish('candidates', { ids: [a.candidate_id] });
  res.json(await model.get(a.candidate_id));
}));

module.exports = { router, removeFiles, detectType };
