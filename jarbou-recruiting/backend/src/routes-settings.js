/* Shared settings (admin), master-data lists, document types, onboarding templates,
   recruitment targets and per-user preferences. */
'use strict';
const express = require('express');
const db = require('./db');
const audit = require('./audit');
const events = require('./events');
const { requirePerm } = require('./rbac');
const { wrap, badRequest, notFound, conflict } = require('./errors');

const router = express.Router();

const SCALARS = {
  companyName: { type: 'text', max: 120, required: true },
  defaultProject: { type: 'text', max: 80 },
  defaultStation: { type: 'text', max: 80 },
  defaultPosition: { type: 'text', max: 80 },
  targetPosition: { type: 'text', max: 80 },
  standardSalaryReference: { type: 'num', min: 0, max: 100000 },
  standardSalaryBasis: { type: 'enum', values: ['net', 'gross'] },
  expiryWarningDays: { type: 'int', min: 1, max: 365 },
  contractWarningDays: { type: 'int', min: 1, max: 90 },
  idPrefix: { type: 'prefix' }
};
const LISTS = { projects: 'projects', stations: 'stations', positions: 'positions', sources: 'recruitment_sources' };
const LIST_FK = { projects: 'project_id', stations: 'station_id', positions: 'position_id', sources: 'source_id' };

function validateScalar(key, v) {
  const d = SCALARS[key];
  if (!d) throw badRequest(`Unknown setting "${key}".`);
  if (d.type === 'text') { v = String(v === null || v === undefined ? '' : v).trim(); if (v.length > d.max) throw badRequest(`Setting "${key}" is too long.`); if (d.required && !v) throw badRequest(`Setting "${key}" is required.`); return v; }
  if (d.type === 'enum') { if (!d.values.includes(v)) throw badRequest(`Invalid value for "${key}".`); return v; }
  if (d.type === 'prefix') { v = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); return v || 'JRB'; }
  const n = Number(v);
  if (!Number.isFinite(n) || n < d.min || n > d.max) throw badRequest(`Invalid value for "${key}".`);
  return d.type === 'int' ? Math.round(n) : n;
}

async function loadSettings() {
  const [scal, projects, stations, positions, sources, docs, steps, targets, recruiters, seq] = await Promise.all([
    db.query('SELECT key, value FROM settings'),
    db.query('SELECT l.id, l.name, l.is_active, (SELECT count(*)::int FROM candidates c WHERE c.project_id = l.id) AS used FROM projects l ORDER BY l.sort_order, l.name'),
    db.query('SELECT l.id, l.name, l.is_active, (SELECT count(*)::int FROM candidates c WHERE c.station_id = l.id) AS used FROM stations l ORDER BY l.sort_order, l.name'),
    db.query('SELECT l.id, l.name, l.is_active, (SELECT count(*)::int FROM candidates c WHERE c.position_id = l.id) AS used FROM positions l ORDER BY l.sort_order, l.name'),
    db.query('SELECT l.id, l.name, l.is_active, (SELECT count(*)::int FROM candidates c WHERE c.source_id = l.id) AS used FROM recruitment_sources l ORDER BY l.sort_order, l.name'),
    db.query('SELECT * FROM document_types ORDER BY sort_order, key'),
    db.query('SELECT * FROM onboarding_templates ORDER BY sort_order, key'),
    db.query(`SELECT t.id, p.name AS project, COALESCE(s.name, '') AS station, t.required FROM recruitment_targets t
              JOIN projects p ON p.id = t.project_id LEFT JOIN stations s ON s.id = t.station_id ORDER BY p.sort_order, p.name, s.sort_order NULLS FIRST, s.name`),
    db.query("SELECT full_name FROM users WHERE is_active AND role IN ('admin','recruiter') ORDER BY full_name"),
    db.query('SELECT last_value, is_called FROM candidate_number_seq')
  ]);
  const s = {};
  for (const r of scal.rows) s[r.key] = r.value;
  const mapList = (rows) => rows.map((r) => ({ id: r.id, name: r.name, active: r.is_active, used: r.used }));
  s.lists = { projects: mapList(projects.rows), stations: mapList(stations.rows), positions: mapList(positions.rows), sources: mapList(sources.rows) };
  for (const k of Object.keys(LISTS)) s[k] = s.lists[k].filter((x) => x.active).map((x) => x.name);
  s.allDocuments = docs.rows.map((d) => ({ key: d.key, label: d.label, short: d.short_label || undefined, required: d.required_default, expiry: d.has_expiry,
    builtin: d.is_builtin, caseByCase: d.case_by_case, active: d.is_active }));
  s.documents = s.allDocuments.filter((d) => d.active);
  s.allOnboardingSteps = steps.rows.map((o) => ({ key: o.key, label: o.label, auto: o.auto_rule || undefined, active: o.is_active }));
  s.onboardingSteps = s.allOnboardingSteps.filter((o) => o.active);
  s.targets = targets.rows;
  s.requiredDrivers = targets.rows.reduce((t, r) => t + (r.station ? 0 : r.required), 0);
  s.recruiters = recruiters.rows.map((r) => r.full_name);
  const last = Number(seq.rows[0].last_value);
  s.nextNumber = seq.rows[0].is_called ? last + 1 : last;
  return s;
}

function changed(req, what) {
  events.publish('settings', { what });
}

/* ---------------------------------------------------------------- read */
router.get('/', requirePerm('read'), wrap(async (req, res) => res.json(await loadSettings())));

/* ---------------------------------------------------------------- scalar settings */
router.put('/', requirePerm('settings.write'), wrap(async (req, res) => {
  const body = req.body || {};
  const keys = Object.keys(body).filter((k) => k in SCALARS);
  if (!keys.length) throw badRequest('No settings to save.');
  await db.tx(async (q) => {
    const before = Object.fromEntries((await q.query('SELECT key, value FROM settings')).rows.map((r) => [r.key, r.value]));
    const changes = [];
    for (const k of keys) {
      const v = validateScalar(k, body[k]);
      if (JSON.stringify(before[k]) === JSON.stringify(v)) continue;
      await q.query('INSERT INTO settings (key, value, updated_at, updated_by) VALUES ($1,$2,now(),$3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by',
        [k, JSON.stringify(v), req.user.id]);
      changes.push({ field: k, from: before[k] === undefined ? null : before[k], to: v });
    }
    if (changes.length) await audit.write(q, req, { action: 'settings.changed', entityType: 'settings', summary: 'Settings changed', changes });
  });
  changed(req, 'settings');
  res.json(await loadSettings());
}));

/* ---------------------------------------------------------------- lists */
function listTable(type) { const t = LISTS[type]; if (!t) throw notFound('Unknown list.'); return t; }
function cleanName(v) {
  const name = String(v || '').trim().replace(/\s+/g, ' ');
  if (!name) throw badRequest('Please enter a name.');
  if (name.length > 80) throw badRequest('Name is too long.');
  return name;
}

router.post('/lists/:type', requirePerm('settings.write'), wrap(async (req, res) => {
  const table = listTable(req.params.type);
  const name = cleanName(req.body && req.body.name);
  await db.tx(async (q) => {
    const ex = (await q.query(`SELECT id, is_active FROM ${table} WHERE lower(name) = lower($1)`, [name])).rows[0];
    if (ex && ex.is_active) throw conflict(`"${name}" already exists.`);
    if (ex) await q.query(`UPDATE ${table} SET is_active = true WHERE id = $1`, [ex.id]);
    else await q.query(`INSERT INTO ${table} (name, sort_order) VALUES ($1, (SELECT COALESCE(max(sort_order), 0) + 1 FROM ${table}))`, [name]);
    await audit.write(q, req, { action: 'settings.list_added', entityType: req.params.type, summary: `${req.params.type}: "${name}" added`, changes: [{ field: req.params.type, from: null, to: name }] });
  });
  changed(req, req.params.type);
  res.status(201).json(await loadSettings());
}));

router.patch('/lists/:type/:id', requirePerm('settings.write'), wrap(async (req, res) => {
  const table = listTable(req.params.type);
  const id = parseInt(req.params.id, 10);
  const body = req.body || {};
  let renamed = false;
  await db.tx(async (q) => {
    const cur = (await q.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!cur) throw notFound();
    const changes = [];
    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (name !== cur.name) {
        const dup = (await q.query(`SELECT 1 FROM ${table} WHERE lower(name) = lower($1) AND id <> $2`, [name, id])).rows.length;
        if (dup) throw conflict(`"${name}" already exists.`);
        await q.query(`UPDATE ${table} SET name = $2 WHERE id = $1`, [id, name]);
        changes.push({ field: 'name', from: cur.name, to: name });
        renamed = true;
      }
    }
    if (body.active !== undefined && !!body.active !== cur.is_active) {
      await q.query(`UPDATE ${table} SET is_active = $2 WHERE id = $1`, [id, !!body.active]);
      changes.push({ field: 'active', from: cur.is_active, to: !!body.active });
    }
    if (body.move === -1 || body.move === 1) {
      const all = (await q.query(`SELECT id FROM ${table} ORDER BY sort_order, name`)).rows.map((r) => r.id);
      const i = all.indexOf(id), j = i + body.move;
      if (j >= 0 && j < all.length) { [all[i], all[j]] = [all[j], all[i]]; for (let k = 0; k < all.length; k++) await q.query(`UPDATE ${table} SET sort_order = $2 WHERE id = $1`, [all[k], k + 1]); }
    }
    if (renamed) {
      // candidates reference the list by id – bump them so every browser re-syncs the new name
      await q.query(`UPDATE candidates SET updated_at = now() WHERE ${LIST_FK[req.params.type]} = $1`, [id]);
    }
    if (changes.length) await audit.write(q, req, { action: 'settings.list_changed', entityType: req.params.type, entityId: String(id), summary: `${req.params.type}: "${cur.name}" changed`, changes });
  });
  changed(req, req.params.type);
  if (renamed) events.publish('candidates', { reload: true });
  res.json(await loadSettings());
}));

router.delete('/lists/:type/:id', requirePerm('settings.write'), wrap(async (req, res) => {
  const table = listTable(req.params.type);
  const id = parseInt(req.params.id, 10);
  await db.tx(async (q) => {
    const cur = (await q.query(`SELECT name FROM ${table} WHERE id = $1`, [id])).rows[0];
    if (!cur) throw notFound();
    const used = (await q.query(`SELECT count(*)::int AS n FROM candidates WHERE ${LIST_FK[req.params.type]} = $1`, [id])).rows[0].n
      + (req.params.type === 'projects' || req.params.type === 'stations' ? (await q.query(`SELECT count(*)::int AS n FROM recruitment_targets WHERE ${LIST_FK[req.params.type]} = $1`, [id])).rows[0].n : 0);
    if (used) throw conflict(`"${cur.name}" is still used by ${used} record(s). Deactivate it instead.`);
    await q.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await audit.write(q, req, { action: 'settings.list_removed', entityType: req.params.type, entityId: String(id), summary: `${req.params.type}: "${cur.name}" removed`, changes: [{ field: req.params.type, from: cur.name, to: null }] });
  });
  changed(req, req.params.type);
  res.json(await loadSettings());
}));

/* ---------------------------------------------------------------- document types */
router.put('/documents', requirePerm('settings.write'), wrap(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : null;
  if (!list || list.length > 60) throw badRequest('Invalid document list.');
  await db.tx(async (q) => {
    const before = (await q.query('SELECT * FROM document_types')).rows;
    const byKey = new Map(before.map((d) => [d.key, d]));
    const seen = new Set();
    const changes = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i] || {};
      let key = String(d.key || '');
      if (!key) key = 'custom_' + Math.random().toString(36).slice(2, 10);
      if (!/^[a-z0-9_]{2,60}$/.test(key)) throw badRequest('Invalid document key.');
      const label = String(d.label || '').trim().slice(0, 120);
      if (!label) throw badRequest('Document name is required.');
      seen.add(key);
      const old = byKey.get(key);
      const row = [key, label, old && old.label === label ? old.short_label : null, !!d.required, !!d.expiry, i + 1];
      if (old) {
        await q.query('UPDATE document_types SET label = $2, short_label = $3, required_default = $4, has_expiry = $5, sort_order = $6, is_active = true WHERE key = $1', row);
        if (old.label !== label || old.required_default !== !!d.required || old.has_expiry !== !!d.expiry || !old.is_active) changes.push({ field: key, from: { label: old.label, required: old.required_default, expiry: old.has_expiry, active: old.is_active }, to: { label, required: !!d.required, expiry: !!d.expiry, active: true } });
      } else {
        await q.query('INSERT INTO document_types (key, label, short_label, required_default, has_expiry, sort_order) VALUES ($1,$2,$3,$4,$5,$6)', row);
        changes.push({ field: key, from: null, to: { label, required: !!d.required, expiry: !!d.expiry } });
      }
    }
    for (const old of before) {
      if (!seen.has(old.key) && old.is_active) {
        if (old.is_builtin) throw badRequest('Built-in documents cannot be removed.');
        await q.query('UPDATE document_types SET is_active = false WHERE key = $1', [old.key]);
        changes.push({ field: old.key, from: { label: old.label, active: true }, to: { active: false } });
      }
    }
    if (changes.length) await audit.write(q, req, { action: 'settings.documents_changed', entityType: 'document_types', summary: 'Document requirements changed', changes });
  });
  changed(req, 'documents');
  res.json(await loadSettings());
}));

/* ---------------------------------------------------------------- onboarding template */
router.put('/onboarding', requirePerm('settings.write'), wrap(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : null;
  if (!list || list.length > 60) throw badRequest('Invalid onboarding list.');
  await db.tx(async (q) => {
    const before = (await q.query('SELECT * FROM onboarding_templates')).rows;
    const byKey = new Map(before.map((d) => [d.key, d]));
    const seen = new Set();
    const changes = [];
    for (let i = 0; i < list.length; i++) {
      const st = list[i] || {};
      let key = String(st.key || '');
      if (!key) key = 'step_' + Math.random().toString(36).slice(2, 10);
      if (!/^[a-z0-9_]{2,60}$/.test(key)) throw badRequest('Invalid step key.');
      const label = String(st.label || '').trim().slice(0, 120);
      if (!label) throw badRequest('Step name is required.');
      seen.add(key);
      const old = byKey.get(key);
      if (old) {
        await q.query('UPDATE onboarding_templates SET label = $2, sort_order = $3, is_active = true WHERE key = $1', [key, label, i + 1]);
        if (old.label !== label || !old.is_active) changes.push({ field: key, from: old.is_active ? old.label : null, to: label });
      } else {
        await q.query('INSERT INTO onboarding_templates (key, label, sort_order) VALUES ($1,$2,$3)', [key, label, i + 1]);
        changes.push({ field: key, from: null, to: label });
      }
    }
    for (const old of before) if (!seen.has(old.key) && old.is_active) {
      await q.query('UPDATE onboarding_templates SET is_active = false WHERE key = $1', [old.key]);
      changes.push({ field: old.key, from: old.label, to: null });
    }
    if (changes.length) await audit.write(q, req, { action: 'settings.onboarding_changed', entityType: 'onboarding_templates', summary: 'Onboarding checklist changed', changes });
  });
  changed(req, 'onboarding');
  res.json(await loadSettings());
}));

/* ---------------------------------------------------------------- recruitment targets */
router.put('/targets', requirePerm('settings.write'), wrap(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : null;
  if (!list || list.length > 200) throw badRequest('Invalid target list.');
  await db.tx(async (q) => {
    const before = (await q.query(`SELECT p.name AS project, COALESCE(s.name,'') AS station, t.required FROM recruitment_targets t JOIN projects p ON p.id = t.project_id LEFT JOIN stations s ON s.id = t.station_id`)).rows;
    await q.query('DELETE FROM recruitment_targets');
    const seen = new Set();
    for (const t of list) {
      const req2 = Number(t && t.required);
      if (!Number.isInteger(req2) || req2 < 0 || req2 > 100000) throw badRequest('Required drivers must be a whole number.');
      const p = (await q.query('SELECT id FROM projects WHERE lower(name) = lower($1)', [String(t.project || '')])).rows[0];
      if (!p) throw badRequest(`Unknown project "${t.project}".`);
      let sid = null;
      if (t.station) {
        const s = (await q.query('SELECT id FROM stations WHERE lower(name) = lower($1)', [String(t.station)])).rows[0];
        if (!s) throw badRequest(`Unknown station "${t.station}".`);
        sid = s.id;
      }
      const k = p.id + ':' + (sid || 0);
      if (seen.has(k)) throw badRequest('Each project/station combination can only have one target.');
      seen.add(k);
      await q.query('INSERT INTO recruitment_targets (project_id, station_id, required) VALUES ($1,$2,$3)', [p.id, sid, req2]);
    }
    await audit.write(q, req, { action: 'settings.targets_changed', entityType: 'recruitment_targets', summary: 'Recruitment targets changed',
      changes: [{ field: 'targets', from: before, to: list.map((t) => ({ project: t.project, station: t.station || '', required: Number(t.required) })) }] });
  });
  changed(req, 'targets');
  res.json(await loadSettings());
}));

/* ---------------------------------------------------------------- personal preferences (any signed-in user) */
const PREFS = {
  language: (v) => (['de', 'en', 'ar'].includes(v) ? v : undefined),
  activeProject: (v) => (typeof v === 'string' && v.length <= 80 ? v : undefined),
  tableColumns: (v) => (Array.isArray(v) && v.length <= 40 && v.every((x) => typeof x === 'string' && x.length < 40) ? v : undefined),
  pageSize: (v) => ([25, 50, 100, 250].includes(Number(v)) ? Number(v) : undefined),
  sidebarCollapsed: (v) => (typeof v === 'boolean' ? v : undefined)
};
const prefsRouter = express.Router();
prefsRouter.put('/preferences', requirePerm('read'), wrap(async (req, res) => {
  const body = req.body || {};
  const next = Object.assign({}, req.user.preferences || {});
  for (const [k, fn] of Object.entries(PREFS)) if (k in body) { const v = fn(body[k]); if (v !== undefined) next[k] = v; }
  await db.query('UPDATE users SET preferences = $2 WHERE id = $1', [req.user.id, JSON.stringify(next)]);
  res.json({ preferences: next });
}));

module.exports = { router, prefsRouter, loadSettings };
