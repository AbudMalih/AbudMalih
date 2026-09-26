/* Candidate API: list/sync, detail, create, field-level update, archive, delete, follow-ups, timeline. */
'use strict';
const express = require('express');
const db = require('./db');
const model = require('./candidate-model');
const audit = require('./audit');
const events = require('./events');
const { requirePerm, can } = require('./rbac');
const { wrap, badRequest, notFound, forbidden } = require('./errors');

const router = express.Router();
const ID = /^[A-Za-z0-9-]{1,20}$/;
function checkId(id) { if (!ID.test(id)) throw notFound('Candidate not found.'); return id; }
const nameOf = (c) => [c.firstName, c.lastName].filter(Boolean).join(' ');

// Fields whose change needs the archive permission, and fields that are never writable here.
const ARCHIVE_FIELDS = ['archived', 'archiveReason', 'archiveDate', 'archiveNote'];

/* GET /api/candidates?since=ISO  – full list or incremental changes */
router.get('/', requirePerm('read'), wrap(async (req, res) => {
  let since = null;
  if (req.query.since) {
    const d = new Date(String(req.query.since));
    if (isNaN(d)) throw badRequest('Invalid since parameter.');
    since = d.toISOString();
  }
  const serverTime = (await db.query('SELECT now() AS t')).rows[0].t;
  const items = await model.list(since);
  const deleted = since ? (await db.query('SELECT candidate_id FROM candidate_deletions WHERE deleted_at > $1', [since])).rows.map((r) => r.candidate_id) : [];
  res.json({ items, deleted, serverTime: new Date(serverTime).toISOString(), full: !since });
}));

router.get('/:id', requirePerm('read'), wrap(async (req, res) => {
  const c = await model.get(checkId(req.params.id));
  if (!c) throw notFound('Candidate not found.');
  res.json(c);
}));

router.post('/', requirePerm('candidate.write'), wrap(async (req, res) => {
  const input = req.body || {};
  if (input.archived && !can(req.user, 'candidate.archive')) throw forbidden();
  const id = await db.tx(async (q) => {
    const newId = await model.create(q, input, req.user);
    await audit.write(q, req, { action: 'candidate.created', entityType: 'candidate', entityId: newId, candidateId: newId,
      summary: `Candidate created: ${String(input.firstName || '').trim()} ${String(input.lastName || '').trim()}` });
    return newId;
  });
  events.publish('candidates', { ids: [id] });
  res.status(201).json(await model.get(id));
}));

/* PATCH /api/candidates/:id  { changes:[{path,from,to}], addActivities:[], removeActivities:[], addNotes:[], removeNotes:[] } */
router.patch('/:id', requirePerm('candidate.write'), wrap(async (req, res) => {
  const id = checkId(req.params.id);
  const body = req.body || {};
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 400) : [];
  for (const ch of changes) if (!ch || typeof ch.path !== 'string') throw badRequest('Invalid change.');
  if (changes.some((ch) => ARCHIVE_FIELDS.includes(ch.path)) && !can(req.user, 'candidate.archive')) throw forbidden();
  const removeActs = Array.isArray(body.removeActivities) ? body.removeActivities.slice(0, 50) : [];
  const removeNotes = Array.isArray(body.removeNotes) ? body.removeNotes.slice(0, 50) : [];
  let summaryName = '';
  const result = await db.tx(async (q) => {
    const lock = await q.query('SELECT id, first_name, last_name FROM candidates WHERE id = $1 FOR UPDATE', [id]);
    if (!lock.rows[0]) throw notFound('Candidate not found.');
    summaryName = lock.rows[0].first_name + ' ' + lock.rows[0].last_name;
    const auditChanges = await model.applyChanges(q, id, changes, req.user);
    const acts = await model.addActivities(q, id, body.addActivities, req.user);
    const notes = await model.addNotes(q, id, body.addNotes, req.user);
    let removed = 0;
    for (const aid of removeActs) {
      const r = await q.query("DELETE FROM candidate_activity WHERE id = $1 AND candidate_id = $2 AND type <> 'system' RETURNING text", [String(aid), id]).catch(() => ({ rowCount: 0 }));
      removed += r.rowCount;
      if (r.rowCount) await audit.write(q, req, { action: 'candidate.activity_deleted', entityType: 'candidate', entityId: id, candidateId: id, summary: `Timeline entry deleted for ${summaryName}`, changes: [{ field: 'activity', from: r.rows[0].text, to: null }] });
    }
    for (const nid of removeNotes) {
      const r = await q.query('DELETE FROM candidate_notes WHERE id = $1 AND candidate_id = $2 RETURNING text', [String(nid), id]).catch(() => ({ rowCount: 0 }));
      removed += r.rowCount;
      if (r.rowCount) await audit.write(q, req, { action: 'candidate.note_deleted', entityType: 'candidate', entityId: id, candidateId: id, summary: `Note deleted for ${summaryName}`, changes: [{ field: 'note', from: r.rows[0].text, to: null }] });
    }
    if (!auditChanges.length && (acts || notes || removed)) await model.touch(q, id, req.user);
    if (auditChanges.length) {
      const archivedCh = auditChanges.find((c) => c.field === 'archived');
      const action = archivedCh ? (archivedCh.to ? 'candidate.archived' : 'candidate.restored') : auditChanges.some((c) => c.field === 'stage') ? 'candidate.stage_changed' : 'candidate.updated';
      await audit.write(q, req, { action, entityType: 'candidate', entityId: id, candidateId: id, summary: `${summaryName}`, changes: auditChanges });
    }
    if (notes) await audit.write(q, req, { action: 'candidate.note_added', entityType: 'candidate', entityId: id, candidateId: id, summary: summaryName });
    return { changed: auditChanges.length + acts + notes + removed };
  });
  if (result.changed) events.publish('candidates', { ids: [id] });
  res.json(await model.get(id));
}));

router.delete('/:id', requirePerm('candidate.delete'), wrap(async (req, res) => {
  const id = checkId(req.params.id);
  const files = await db.tx(async (q) => {
    const r = await q.query('SELECT first_name, last_name, archived FROM candidates WHERE id = $1 FOR UPDATE', [id]);
    if (!r.rows[0]) throw notFound('Candidate not found.');
    if (!r.rows[0].archived) throw badRequest('Only archived candidates can be deleted permanently. Archive the candidate first.');
    const f = (await q.query('SELECT stored_name FROM attachments WHERE candidate_id = $1', [id])).rows.map((x) => x.stored_name);
    await q.query('DELETE FROM candidates WHERE id = $1', [id]);
    await q.query('INSERT INTO candidate_deletions (candidate_id) VALUES ($1) ON CONFLICT (candidate_id) DO UPDATE SET deleted_at = now()', [id]);
    await audit.write(q, req, { action: 'candidate.deleted', entityType: 'candidate', entityId: id, candidateId: id, summary: `Candidate permanently deleted: ${r.rows[0].first_name} ${r.rows[0].last_name}` });
    return f;
  });
  require('./attachments').removeFiles(files);
  events.publish('candidates', { deleted: [id] });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- follow-ups */
function checkFollow(body) {
  const date = String(body.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Please choose a follow-up date.');
  const time = body.time ? String(body.time) : '';
  if (time && !/^\d{2}:\d{2}$/.test(time)) throw badRequest('Invalid time.');
  const type = model.FOLLOW_TYPES.includes(body.type) ? body.type : 'phone';
  return { date, time: time || null, type, note: String(body.note || '').slice(0, 500) };
}

router.post('/:id/follow-ups', requirePerm('candidate.write'), wrap(async (req, res) => {
  const id = checkId(req.params.id);
  const f = checkFollow(req.body || {});
  await db.tx(async (q) => {
    const c = (await q.query('SELECT first_name, last_name FROM candidates WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!c) throw notFound('Candidate not found.');
    if (req.body.replaceOpen) await q.query("UPDATE follow_ups SET status = 'cancelled', completed_at = now(), completed_by = $2 WHERE candidate_id = $1 AND status = 'open'", [id, req.user.id]);
    await q.query('INSERT INTO follow_ups (candidate_id, due_date, due_time, type, note, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [id, f.date, f.time, f.type, f.note, req.user.id]);
    if (req.body.activityText) await model.addActivities(q, id, [{ type: 'system', text: String(req.body.activityText) }], req.user);
    await model.touch(q, id, req.user);
    await audit.write(q, req, { action: 'followup.created', entityType: 'follow_up', entityId: id, candidateId: id, summary: `${c.first_name} ${c.last_name}`, changes: [{ field: 'followUp', from: null, to: `${f.date}${f.time ? ' ' + f.time : ''} ${f.type}${f.note ? ' – ' + f.note : ''}` }] });
  });
  events.publish('candidates', { ids: [id] });
  res.status(201).json(await model.get(id));
}));

router.post('/:id/follow-ups/:fid/complete', requirePerm('candidate.write'), wrap(async (req, res) => {
  const id = checkId(req.params.id);
  await db.tx(async (q) => {
    const r = await q.query("UPDATE follow_ups SET status = 'done', completed_at = now(), completed_by = $3 WHERE id = $1 AND candidate_id = $2 AND status = 'open' RETURNING due_date, note", [String(req.params.fid), id, req.user.id]).catch(() => ({ rowCount: 0 }));
    if (!r.rowCount) throw notFound('Follow-up not found or already completed.');
    if (req.body && req.body.activityText) await model.addActivities(q, id, [{ type: 'system', text: String(req.body.activityText) }], req.user);
    await model.touch(q, id, req.user);
    await audit.write(q, req, { action: 'followup.completed', entityType: 'follow_up', entityId: id, candidateId: id, summary: `Follow-up ${r.rows[0].due_date} completed`, changes: [{ field: 'followUp', from: `${r.rows[0].due_date} ${r.rows[0].note}`, to: 'done' }] });
  });
  events.publish('candidates', { ids: [id] });
  res.json(await model.get(id));
}));

module.exports = router;
