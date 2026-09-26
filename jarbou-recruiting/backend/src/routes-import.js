/* Import of JSON backups from the offline (single-browser) edition into PostgreSQL.
   Two steps: preview (validate + detect duplicates, nothing written) and commit (one transaction). */
'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const model = require('./candidate-model');
const audit = require('./audit');
const events = require('./events');
const { requirePerm } = require('./rbac');
const { wrap, badRequest, notFound } = require('./errors');

const router = express.Router();
router.use(requirePerm('import'));

const pending = new Map(); // token -> { data, userId, created }
const SOURCE_ALIASES = { recommendation: 'Referral', empfehlung: 'Referral' };
const digits = (s) => String(s || '').replace(/\D/g, '');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function parse(body) {
  if (!body || typeof body !== 'object') throw badRequest('The file is not valid JSON.');
  if (body.app !== 'jarbou-recruiting') throw badRequest('This file is not a JARBOU Recruiting backup.');
  if (!Array.isArray(body.candidates)) throw badRequest('The backup contains no candidate list.');
  if (body.candidates.length > 20000) throw badRequest('The backup is too large.');
  const cands = body.candidates.filter((c) => c && typeof c === 'object' && (c.firstName || c.lastName));
  const settings = (body.meta && body.meta.settings) || {};
  for (const c of cands) if (c.source && SOURCE_ALIASES[norm(c.source)]) c.source = SOURCE_ALIASES[norm(c.source)];
  return { cands, settings };
}

async function analyse(data) {
  const existing = (await db.query('SELECT id, first_name, last_name, phone FROM candidates')).rows;
  const byName = new Map(); const byPhone = new Map(); const byId = new Map();
  for (const e of existing) {
    byName.set(norm(e.first_name + ' ' + e.last_name), e);
    if (digits(e.phone).length >= 6) byPhone.set(digits(e.phone), e);
    byId.set(e.id, e);
  }
  const rows = data.cands.map((c) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
    let dup = null; let reason = '';
    const n = byName.get(norm(name));
    if (n) { dup = n; reason = 'same name'; }
    else if (digits(c.phone).length >= 6 && byPhone.get(digits(c.phone))) { dup = byPhone.get(digits(c.phone)); reason = 'same phone number'; }
    const idTaken = c.id && byId.has(c.id);
    return { legacyId: c.id || '', name, startDate: c.startDate || '', archived: !!c.archived, duplicateOf: dup ? dup.id : null,
      duplicateName: dup ? dup.first_name + ' ' + dup.last_name : '', reason, newIdNeeded: !!idTaken };
  });
  const lists = {};
  for (const [key, table, field] of [['projects', 'projects', 'project'], ['stations', 'stations', 'station'], ['positions', 'positions', 'position'], ['sources', 'recruitment_sources', 'source']]) {
    const have = new Set((await db.query(`SELECT lower(name) AS n FROM ${table}`)).rows.map((r) => r.n));
    const wanted = new Set();
    for (const c of data.cands) if (c[field]) wanted.add(String(c[field]).trim());
    lists[key] = [...wanted].filter((v) => v && !have.has(v.toLowerCase())).slice(0, 100);
  }
  const docKeys = new Set((await db.query('SELECT key FROM document_types')).rows.map((r) => r.key));
  const stepKeys = new Set((await db.query('SELECT key FROM onboarding_templates')).rows.map((r) => r.key));
  const newDocs = (data.settings.documents || []).filter((d) => d && /^[a-z0-9_]{2,60}$/.test(d.key || '') && !docKeys.has(d.key) && d.label);
  const newSteps = (data.settings.onboardingSteps || []).filter((s) => s && /^[a-z0-9_]{2,60}$/.test(s.key || '') && !stepKeys.has(s.key) && s.label);
  return { rows, lists, newDocs, newSteps };
}

router.post('/legacy/preview', express.json({ limit: '60mb' }), wrap(async (req, res) => {
  const data = parse(req.body);
  const a = await analyse(data);
  const token = crypto.randomBytes(16).toString('hex');
  for (const [k, v] of pending) if (Date.now() - v.created > 30 * 60 * 1000) pending.delete(k);
  pending.set(token, { data, userId: req.user.id, created: Date.now() });
  res.json({
    token, total: a.rows.length, duplicates: a.rows.filter((r) => r.duplicateOf).length, archived: a.rows.filter((r) => r.archived).length,
    exportedAt: req.body.exportedAt || '', rows: a.rows.slice(0, 1000),
    createLists: a.lists, newDocuments: a.newDocs.map((d) => d.label), newOnboardingSteps: a.newSteps.map((s) => s.label)
  });
}));

router.post('/legacy/commit', wrap(async (req, res) => {
  const p = pending.get(String((req.body && req.body.token) || ''));
  if (!p || p.userId !== req.user.id) throw notFound('The import preview has expired. Please select the file again.');
  const includeDuplicates = !!(req.body && req.body.includeDuplicates);
  const a = await analyse(p.data);
  const summary = await db.tx(async (q) => {
    const created = { projects: 0, stations: 0, positions: 0, sources: 0, documents: 0, steps: 0 };
    for (const [key, table] of [['projects', 'projects'], ['stations', 'stations'], ['positions', 'positions'], ['sources', 'recruitment_sources']]) {
      for (const name of a.lists[key]) {
        await q.query(`INSERT INTO ${table} (name, sort_order) VALUES ($1, (SELECT COALESCE(max(sort_order),0)+1 FROM ${table})) ON CONFLICT DO NOTHING`, [name.slice(0, 80)]);
        created[key]++;
      }
    }
    for (const d of a.newDocs) {
      await q.query('INSERT INTO document_types (key, label, required_default, has_expiry, sort_order) VALUES ($1,$2,$3,$4,100) ON CONFLICT DO NOTHING', [d.key, String(d.label).slice(0, 120), !!d.required, !!d.expiry]);
      created.documents++;
    }
    for (const s of a.newSteps) {
      await q.query('INSERT INTO onboarding_templates (key, label, sort_order) VALUES ($1,$2,100) ON CONFLICT DO NOTHING', [s.key, String(s.label).slice(0, 120)]);
      created.steps++;
    }
    let imported = 0, skipped = 0;
    const ids = [];
    for (let i = 0; i < p.data.cands.length; i++) {
      const c = p.data.cands[i];
      if (a.rows[i].duplicateOf && !includeDuplicates) { skipped++; continue; }
      const input = Object.assign({}, c);
      if (!input.firstName) input.firstName = '—';
      if (!input.lastName) input.lastName = '—';
      input.activities = (c.activities || []).map((x) => ({ type: x.type, date: x.date, text: x.text })).concat([{ type: 'system', text: 'Imported from offline edition backup' + (c.id ? ' (' + c.id + ')' : '') + '.' }]);
      input.noteLog = c.noteLog || [];
      const id = await model.create(q, input, req.user, { keepId: c.id, createdAt: c.createdAt || null, lenient: true });
      ids.push(id);
      imported++;
    }
    await audit.write(q, req, { action: 'import.legacy', entityType: 'import', summary: `Offline backup imported: ${imported} candidates imported, ${skipped} duplicates skipped`,
      changes: [{ field: 'import', from: null, to: { imported, skipped, created, candidateIds: ids.slice(0, 500) } }] });
    return { imported, skipped, created };
  });
  pending.delete(req.body.token);
  events.publish('candidates', { reload: true });
  events.publish('settings', { what: 'import' });
  res.json(summary);
}));

module.exports = router;
