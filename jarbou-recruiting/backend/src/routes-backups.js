/* Backup administration (admin only): list, create now, download, upload, restore, delete. */
'use strict';
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');
const backup = require('./backup');
const audit = require('./audit');
const events = require('./events');
const { requirePerm } = require('./rbac');
const { wrap, badRequest, HttpError } = require('./errors');

const router = express.Router();
router.use(requirePerm('backup.manage'));

router.get('/', wrap(async (req, res) => {
  const files = backup.listFiles();
  const history = (await db.query('SELECT file_name, kind, status, size_bytes, started_at, finished_at, message, created_by FROM backup_history ORDER BY started_at DESC LIMIT 20')).rows;
  const lastSuccess = (await db.query("SELECT file_name, finished_at FROM backup_history WHERE status = 'success' ORDER BY finished_at DESC LIMIT 1")).rows[0] || null;
  const lastAny = history[0] || null;
  res.json({
    files, history,
    lastSuccess: lastSuccess || (files[0] ? { file_name: files[0].name, finished_at: files[0].createdAt } : null),
    lastStatus: lastAny ? lastAny.status : null,
    lastMessage: lastAny && lastAny.status === 'failed' ? lastAny.message : '',
    nextScheduled: config.backup.enabled ? backup.nextScheduled().toISOString() : null,
    busy: backup.status().busy,
    config: { enabled: config.backup.enabled, time: config.backup.time, keepDaily: config.backup.keepDaily, keepWeekly: config.backup.keepWeekly,
      keepMonthly: config.backup.keepMonthly, location: config.paths.backups, timezone: config.timezone }
  });
}));

router.post('/', wrap(async (req, res) => {
  const r = await backup.createBackup('manual', req.user.full_name);
  await audit.write(null, req, { action: 'backup.created', entityType: 'backup', entityId: r.name, summary: `Manual backup created (${Math.round(r.size / 1024)} KB)` });
  res.status(201).json(r);
}));

router.get('/:name/download', wrap(async (req, res) => {
  const file = backup.fileFor(String(req.params.name));
  await audit.write(null, req, { action: 'backup.downloaded', entityType: 'backup', entityId: req.params.name, summary: 'Backup file downloaded' });
  res.download(file, req.params.name, { headers: { 'Cache-Control': 'no-store' } });
}));

const incoming = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(config.paths.backups, '.incoming'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, file, cb) => cb(null, 'upload-' + Date.now() + '.tar.gz')
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 1 }
});
router.post('/upload', incoming.single('file'), wrap(async (req, res) => {
  if (!req.file) throw badRequest('Please choose a backup file (.tar.gz).');
  try {
    const manifest = await backup.readManifest(req.file.path);
    const name = `jarbou-recruiting_${backup.stamp(new Date())}_uploaded.tar.gz`;
    fs.renameSync(req.file.path, path.join(config.paths.backups, name));
    await audit.write(null, req, { action: 'backup.uploaded', entityType: 'backup', entityId: name, summary: `Backup file uploaded (created ${manifest.createdAt})` });
    res.status(201).json({ name, manifest });
  } catch (e) {
    fs.rmSync(req.file.path, { force: true });
    throw badRequest('This file is not a valid JARBOU Recruiting server backup (.tar.gz).');
  }
}));

router.get('/:name/manifest', wrap(async (req, res) => {
  res.json(await backup.readManifest(backup.fileFor(String(req.params.name))));
}));

router.post('/:name/restore', wrap(async (req, res) => {
  if (!req.body || req.body.confirm !== 'RESTORE') throw badRequest('Please confirm the restore by typing RESTORE.');
  const name = String(req.params.name);
  backup.fileFor(name);
  const actor = { user: req.user, ip: req.ip };
  const result = await backup.restoreBackup(name, req.user.full_name);
  // The database now contains the restored data – record the restore there (actor kept by name).
  await audit.write(null, { user: { id: null, full_name: actor.user.full_name, role: actor.user.role }, ip: actor.ip },
    { action: 'backup.restored', entityType: 'backup', entityId: name, summary: `Database restored from ${name} by ${actor.user.full_name} (safety backup ${result.safetyBackup})` });
  events.publish('candidates', { reload: true });
  events.publish('session', { signedOut: true });
  res.json(result);
}));

router.delete('/:name', wrap(async (req, res) => {
  const file = backup.fileFor(String(req.params.name));
  fs.unlinkSync(file);
  await audit.write(null, req, { action: 'backup.deleted', entityType: 'backup', entityId: req.params.name, summary: 'Backup file deleted' });
  res.json({ ok: true });
}));

module.exports = router;
