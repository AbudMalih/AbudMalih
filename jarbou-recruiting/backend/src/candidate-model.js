/* Candidate model: maps the normalised PostgreSQL tables to the candidate object used by the
   frontend, validates input and applies field-level changes with conflict detection.

   Concurrency model (optimistic, field-level):
   the client sends each changed field as {path, from, to}. A change is applied only if the value
   currently stored still equals `from` (nobody else changed it) or already equals `to`.
   Otherwise the whole save is rejected with 409 – newer data is never silently overwritten. */
'use strict';
const db = require('./db');
const { badRequest, conflict, notFound } = require('./errors');

/* ------------------------------------------------------------------ field definitions */
const T = { text: 'text', date: 'date', num: 'num', bool: 'bool', enum: 'enum' };
// path -> [column, type, maxLength | allowed values]
const SCALARS = {
  firstName: ['first_name', T.text, 100], lastName: ['last_name', T.text, 100], phone: ['phone', T.text, 40],
  email: ['email', T.text, 160], dob: ['dob', T.date], address: ['address', T.text, 200], city: ['city', T.text, 100],
  nationality: ['nationality', T.text, 80], language: ['language', T.text, 80], employmentType: ['employment_type', T.text, 40],
  startDate: ['start_date', T.date], taxClass: ['tax_class', T.text, 40], salaryReference: ['salary_reference', T.num],
  salaryBasis: ['salary_basis', T.enum, ['net', 'gross']], salaryExpectationMin: ['salary_expectation_min', T.num],
  salaryExpectationMax: ['salary_expectation_max', T.num], hoursPerWeek: ['hours_per_week', T.num],
  availability: ['availability', T.enum, ['', 'ready', 'later', 'undecided', 'not_available']],
  applicationDate: ['application_date', T.date], interviewDate: ['interview_date', T.date],
  interviewStatus: ['interview_status', T.enum, ['Not Scheduled', 'Scheduled', 'Completed', 'No Show', 'Cancelled']],
  stage: ['stage', T.enum, ['new', 'contacted', 'interview', 'interested', 'documents', 'contract', 'ready', 'started']],
  nextAction: ['next_action', T.text, 500], notes: ['notes', T.text, 20000], lastContact: ['last_contact', T.date],
  readySince: ['ready_since', T.date], startedOn: ['started_on', T.date],
  archived: ['archived', T.bool], archiveReason: ['archive_reason', T.text, 80], archiveDate: ['archive_date', T.date],
  archiveNote: ['archive_note', T.text, 1000]
};
const LOOKUPS = { project: ['project_id', 'projects'], station: ['station_id', 'stations'], position: ['position_id', 'positions'], source: ['source_id', 'recruitment_sources'] };
const DOC_FIELDS = { status: [T.enum, ['not_required', 'missing', 'requested', 'received', 'verified']], issueDate: [T.date], expiryDate: [T.date], note: [T.text, 500] };
const DOC_COLS = { status: 'status', issueDate: 'issue_date', expiryDate: 'expiry_date', note: 'note' };
const CONTRACT_FIELDS = {
  status: ['status', T.enum, ['not_started', 'preparing', 'prepared', 'sent', 'signed', 'completed']], type: ['contract_type', T.text, 40],
  salary: ['salary', T.num], hours: ['hours', T.num], startDate: ['start_date', T.date], endDate: ['end_date', T.date],
  signedDate: ['signed_date', T.date], note: ['note', T.text, 2000]
};
const ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'document', 'note', 'other', 'system'];
const FOLLOW_TYPES = ['phone', 'whatsapp', 'email', 'meeting', 'other'];

/* ------------------------------------------------------------------ value helpers */
function norm(v) {
  // '' / null / undefined / false are equivalent "empty" values (e.g. an onboarding step without a row = not done)
  if (v === undefined || v === null || v === '' || v === false) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v;
  return String(v);
}
function same(a, b) {
  a = norm(a); b = norm(b);
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}
function checkValue(path, value, type, extra) {
  if (value === undefined || value === null || value === '') {
    if (type === T.bool) return false;
    if (type === T.text) return '';
    if (type === T.enum) { if (extra.includes('')) return ''; throw badRequest(`Field "${path}" is required.`); }
    return null;
  }
  switch (type) {
    case T.text:
      if (typeof value !== 'string') throw badRequest(`Field "${path}" must be text.`);
      if (value.length > extra) throw badRequest(`Field "${path}" is too long.`);
      return value;
    case T.date:
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value + 'T00:00:00Z'))) throw badRequest(`Field "${path}" must be a date (YYYY-MM-DD).`);
      return value;
    case T.num: {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 1e7) throw badRequest(`Field "${path}" must be a positive number.`);
      return n;
    }
    case T.bool: return value === true || value === 'true';
    case T.enum:
      if (!extra.includes(value)) throw badRequest(`Field "${path}" has an invalid value.`);
      return value;
  }
  throw badRequest(`Field "${path}" is not supported.`);
}
function isoOrNull(d) { return d ? new Date(d).toISOString() : ''; }

/* ------------------------------------------------------------------ reading */
const BASE_SELECT = `
  SELECT c.*, p.name AS project_name, s.name AS station_name, po.name AS position_name, rs.name AS source_name,
         ru.full_name AS recruiter_name, cb.full_name AS created_by_name, ub.full_name AS updated_by_name
  FROM candidates c
  LEFT JOIN projects p ON p.id = c.project_id
  LEFT JOIN stations s ON s.id = c.station_id
  LEFT JOIN positions po ON po.id = c.position_id
  LEFT JOIN recruitment_sources rs ON rs.id = c.source_id
  LEFT JOIN users ru ON ru.id = c.recruiter_id
  LEFT JOIN users cb ON cb.id = c.created_by
  LEFT JOIN users ub ON ub.id = c.updated_by`;

function rowToCandidate(r) {
  const c = {
    id: r.id, version: r.version, createdAt: isoOrNull(r.created_at), updatedAt: isoOrNull(r.updated_at),
    createdBy: r.created_by_name || '', updatedBy: r.updated_by_name || '',
    project: r.project_name || '', station: r.station_name || '', position: r.position_name || '', source: r.source_name || '',
    recruiter: r.recruiter_name || r.recruiter_label || '',
    documents: {}, contract: { status: 'not_started', type: '', salary: null, hours: null, startDate: '', endDate: '', signedDate: '', note: '' },
    onboarding: {}, followUpDate: '', followUpNote: '', followUpTime: '', followUpType: '', followUpId: ''
  };
  for (const [path, [col, type]] of Object.entries(SCALARS)) {
    const v = r[col];
    c[path] = type === T.bool ? !!v : type === T.num ? (v === null ? null : Number(v)) : v === null ? '' : v;
  }
  return c;
}

async function attachChildren(q, list, ids) {
  if (!list.length) return list;
  const byId = new Map(list.map((c) => [c.id, c]));
  const filter = ids ? ' WHERE candidate_id = ANY($1)' : '';
  const params = ids ? [ids] : [];
  const [docs, contracts, onboarding, follow] = await Promise.all([
    q.query('SELECT candidate_id, doc_key, status, issue_date, expiry_date, note FROM candidate_documents' + filter, params),
    q.query('SELECT * FROM contracts' + filter, params),
    q.query('SELECT candidate_id, step_key, done, done_date FROM candidate_onboarding' + filter, params),
    q.query(`SELECT DISTINCT ON (candidate_id) id, candidate_id, due_date, due_time, type, note FROM follow_ups
             WHERE status = 'open'${ids ? ' AND candidate_id = ANY($1)' : ''} ORDER BY candidate_id, due_date, due_time NULLS LAST`, params)
  ]);
  for (const d of docs.rows) {
    const c = byId.get(d.candidate_id); if (!c) continue;
    c.documents[d.doc_key] = { status: d.status, issueDate: d.issue_date || '', expiryDate: d.expiry_date || '', note: d.note || '' };
  }
  for (const k of contracts.rows) {
    const c = byId.get(k.candidate_id); if (!c) continue;
    c.contract = { status: k.status, type: k.contract_type || '', salary: k.salary, hours: k.hours, startDate: k.start_date || '',
      endDate: k.end_date || '', signedDate: k.signed_date || '', note: k.note || '' };
  }
  for (const o of onboarding.rows) {
    const c = byId.get(o.candidate_id); if (!c) continue;
    c.onboarding[o.step_key] = { done: o.done, date: o.done_date || '' };
  }
  for (const f of follow.rows) {
    const c = byId.get(f.candidate_id); if (!c) continue;
    c.followUpDate = f.due_date; c.followUpNote = f.note || ''; c.followUpTime = f.due_time ? String(f.due_time).slice(0, 5) : '';
    c.followUpType = f.type; c.followUpId = f.id;
  }
  return list;
}

/** Compact list for the in-browser cache (no timeline/notes). `since` = ISO timestamp for incremental sync. */
async function list(since) {
  const r = await db.query(BASE_SELECT + (since ? ' WHERE c.updated_at > $1' : '') + ' ORDER BY c.id', since ? [since] : []);
  const items = r.rows.map(rowToCandidate);
  await attachChildren(db, items, since ? items.map((c) => c.id) : null);
  return items;
}

/** Full candidate incl. timeline, notes, attachments and follow-ups. */
async function get(id, q) {
  q = q || db;
  const r = await q.query(BASE_SELECT + ' WHERE c.id = $1', [id]);
  if (!r.rows[0]) return null;
  const c = rowToCandidate(r.rows[0]);
  await attachChildren(q, [c], [id]);
  const [acts, notes, files, fus] = await Promise.all([
    q.query(`SELECT a.id, a.type, a.occurred_at, a.text, u.full_name AS by FROM candidate_activity a LEFT JOIN users u ON u.id = a.created_by
             WHERE a.candidate_id = $1 ORDER BY a.occurred_at DESC LIMIT 500`, [id]),
    q.query(`SELECT n.id, n.text, n.created_at, u.full_name AS by FROM candidate_notes n LEFT JOIN users u ON u.id = n.created_by
             WHERE n.candidate_id = $1 ORDER BY n.created_at DESC`, [id]),
    q.query(`SELECT f.id, f.doc_key, f.original_name, f.mime_type, f.size_bytes, f.created_at, u.full_name AS by FROM attachments f
             LEFT JOIN users u ON u.id = f.created_by WHERE f.candidate_id = $1 ORDER BY f.created_at DESC`, [id]),
    q.query(`SELECT f.id, f.due_date, f.due_time, f.type, f.note, f.status, f.created_at, f.completed_at, u.full_name AS by, cu.full_name AS completed_by
             FROM follow_ups f LEFT JOIN users u ON u.id = f.created_by LEFT JOIN users cu ON cu.id = f.completed_by
             WHERE f.candidate_id = $1 ORDER BY f.due_date DESC LIMIT 100`, [id])
  ]);
  c.activities = acts.rows.map((a) => ({ id: a.id, type: a.type, date: isoOrNull(a.occurred_at), text: a.text, by: a.by || '' }));
  c.noteLog = notes.rows.map((n) => ({ id: n.id, date: isoOrNull(n.created_at), text: n.text, by: n.by || '' }));
  c.attachments = files.rows.map((f) => ({ id: f.id, docKey: f.doc_key || '', name: f.original_name, mime: f.mime_type, size: Number(f.size_bytes), date: isoOrNull(f.created_at), by: f.by || '' }));
  c.followUps = fus.rows.map((f) => ({ id: f.id, date: f.due_date, time: f.due_time ? String(f.due_time).slice(0, 5) : '', type: f.type, note: f.note, status: f.status,
    by: f.by || '', createdAt: isoOrNull(f.created_at), completedAt: isoOrNull(f.completed_at), completedBy: f.completed_by || '' }));
  c.detail = true;
  return c;
}

/* ------------------------------------------------------------------ lookups */
async function resolveLookup(q, key, name) {
  if (!name) return null;
  const [, table] = LOOKUPS[key];
  const r = await q.query(`SELECT id FROM ${table} WHERE lower(name) = lower($1)`, [String(name).trim()]);
  if (!r.rows[0]) throw badRequest(`Unknown ${key} "${name}". Please ask an administrator to add it in Settings.`);
  return r.rows[0].id;
}
async function resolveRecruiter(q, name) {
  if (!name) return { id: null, label: '' };
  const r = await q.query(`SELECT id FROM users WHERE role IN ('admin','recruiter') AND (lower(full_name) = lower($1) OR lower(username) = lower($1)) ORDER BY is_active DESC LIMIT 1`, [String(name).trim()]);
  if (r.rows[0]) return { id: r.rows[0].id, label: '' };
  if (String(name).length > 120) throw badRequest('Recruiter name is too long.');
  return { id: null, label: String(name).trim() };
}
async function docKeys(q) { return new Set((await q.query('SELECT key FROM document_types')).rows.map((r) => r.key)); }
async function stepKeys(q) { return new Set((await q.query('SELECT key FROM onboarding_templates')).rows.map((r) => r.key)); }

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

/* ------------------------------------------------------------------ writing */
/**
 * Apply a list of field changes to candidate `id` inside transaction client `q`.
 * @returns {Array} audit change list [{field, from, to}]
 */
async function applyChanges(q, id, changes, user, opts) {
  opts = opts || {};
  const current = await get(id, q);
  if (!current) throw notFound('Candidate not found.');
  if (!opts.skipConflictCheck) {
    const conflicts = [];
    for (const ch of changes) {
      const cur = getPath(current, ch.path);
      if (!same(cur, ch.from) && !same(cur, ch.to)) conflicts.push({ field: ch.path, yours: ch.to, theirs: cur === undefined ? null : cur });
    }
    if (conflicts.length) throw conflict('This candidate was updated by another user. Please reload the latest version before saving.', { conflicts, updatedBy: current.updatedBy, updatedAt: current.updatedAt });
  }

  const cols = {}; const docs = {}; const contract = {}; const onboarding = {}; const follow = {};
  const auditChanges = [];
  let dKeys = null; let sKeys = null;
  for (const ch of changes) {
    if (typeof ch.path !== 'string' || ch.path.length > 120) throw badRequest('Invalid field.');
    const parts = ch.path.split('.');
    const before = getPath(current, ch.path);
    if (same(before, ch.to)) continue;
    let value;
    if (parts.length === 1 && SCALARS[parts[0]]) {
      const [col, type, extra] = SCALARS[parts[0]];
      value = checkValue(ch.path, ch.to, type, extra);
      if ((parts[0] === 'firstName' || parts[0] === 'lastName') && !String(value).trim()) throw badRequest('First and family name are required.');
      cols[col] = value;
    } else if (parts.length === 1 && LOOKUPS[parts[0]]) {
      value = ch.to ? String(ch.to) : '';
      cols[LOOKUPS[parts[0]][0]] = await resolveLookup(q, parts[0], value);
    } else if (ch.path === 'recruiter') {
      value = ch.to ? String(ch.to) : '';
      const rec = await resolveRecruiter(q, value);
      cols.recruiter_id = rec.id; cols.recruiter_label = rec.label;
    } else if (parts[0] === 'documents' && parts.length === 3 && DOC_FIELDS[parts[2]]) {
      dKeys = dKeys || await docKeys(q);
      if (!dKeys.has(parts[1])) throw badRequest(`Unknown document "${parts[1]}".`);
      const [type, extra] = DOC_FIELDS[parts[2]];
      value = checkValue(ch.path, ch.to, type, extra);
      (docs[parts[1]] = docs[parts[1]] || {})[DOC_COLS[parts[2]]] = value;
    } else if (parts[0] === 'contract' && parts.length === 2 && CONTRACT_FIELDS[parts[1]]) {
      const [col, type, extra] = CONTRACT_FIELDS[parts[1]];
      value = checkValue(ch.path, ch.to, type, extra);
      contract[col] = value;
    } else if (parts[0] === 'onboarding' && parts.length === 3 && (parts[2] === 'done' || parts[2] === 'date')) {
      sKeys = sKeys || await stepKeys(q);
      if (!sKeys.has(parts[1])) throw badRequest(`Unknown onboarding step "${parts[1]}".`);
      value = parts[2] === 'done' ? checkValue(ch.path, ch.to, T.bool) : checkValue(ch.path, ch.to, T.date);
      (onboarding[parts[1]] = onboarding[parts[1]] || {})[parts[2] === 'done' ? 'done' : 'done_date'] = value;
    } else if (ch.path === 'followUpDate' || ch.path === 'followUpNote') {
      value = ch.path === 'followUpDate' ? checkValue(ch.path, ch.to, T.date) : checkValue(ch.path, ch.to, T.text, 500);
      follow[ch.path] = value;
    } else {
      continue; // derived/read-only fields (updatedAt, createdBy …) are ignored
    }
    auditChanges.push({ field: ch.path, from: before === undefined ? null : before, to: value });
  }
  if (!auditChanges.length) return [];

  // candidate row
  const setCols = Object.keys(cols);
  const params = [id, user.id];
  const sets = setCols.map((col, i) => { params.push(cols[col]); return `${col} = $${i + 3}`; });
  await q.query(`UPDATE candidates SET ${sets.concat(['version = version + 1', 'updated_at = now()', 'updated_by = $2']).join(', ')} WHERE id = $1`, params);

  for (const [key, fields] of Object.entries(docs)) {
    const cur = current.documents[key] || { status: 'missing' };
    const row = { status: fields.status !== undefined ? fields.status : cur.status || 'missing',
      issue_date: fields.issue_date !== undefined ? fields.issue_date : cur.issueDate || null,
      expiry_date: fields.expiry_date !== undefined ? fields.expiry_date : cur.expiryDate || null,
      note: fields.note !== undefined ? fields.note : cur.note || '' };
    await q.query(`INSERT INTO candidate_documents (candidate_id, doc_key, status, issue_date, expiry_date, note, updated_at, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,now(),$7) ON CONFLICT (candidate_id, doc_key) DO UPDATE SET status = EXCLUDED.status,
      issue_date = EXCLUDED.issue_date, expiry_date = EXCLUDED.expiry_date, note = EXCLUDED.note, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [id, key, row.status, row.issue_date || null, row.expiry_date || null, row.note, user.id]);
  }
  if (Object.keys(contract).length) {
    const keys = Object.keys(contract);
    const p = [id, user.id];
    const s = keys.map((k, i) => { p.push(contract[k]); return `${k} = $${i + 3}`; });
    await q.query('INSERT INTO contracts (candidate_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
    await q.query(`UPDATE contracts SET ${s.join(', ')}, updated_at = now(), updated_by = $2 WHERE candidate_id = $1`, p);
  }
  for (const [key, f] of Object.entries(onboarding)) {
    const cur = current.onboarding[key] || { done: false, date: '' };
    const done = f.done !== undefined ? f.done : !!cur.done;
    const date = f.done_date !== undefined ? f.done_date : (cur.date || null);
    await q.query(`INSERT INTO candidate_onboarding (candidate_id, step_key, done, done_date, updated_at, updated_by) VALUES ($1,$2,$3,$4,now(),$5)
      ON CONFLICT (candidate_id, step_key) DO UPDATE SET done = EXCLUDED.done, done_date = EXCLUDED.done_date, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [id, key, done, done ? (date || null) : null, user.id]);
  }
  if (Object.keys(follow).length) {
    const open = current.followUpId;
    const date = follow.followUpDate !== undefined ? follow.followUpDate : current.followUpDate || null;
    const note = follow.followUpNote !== undefined ? follow.followUpNote : current.followUpNote || '';
    if (!date && open) {
      await q.query(`UPDATE follow_ups SET status = 'done', completed_at = now(), completed_by = $2 WHERE id = $1`, [open, user.id]);
    } else if (date && open) {
      await q.query('UPDATE follow_ups SET due_date = $2, note = $3 WHERE id = $1', [open, date, note]);
    } else if (date) {
      await q.query('INSERT INTO follow_ups (candidate_id, due_date, note, created_by) VALUES ($1,$2,$3,$4)', [id, date, note, user.id]);
    }
  }
  return auditChanges;
}

/** Validate & insert activities sent by the client (new timeline entries). */
async function addActivities(q, id, activities, user) {
  let n = 0;
  for (const a of (activities || []).slice(0, 50)) {
    if (!a || typeof a.text !== 'string' || !a.text.trim()) continue;
    const type = ACTIVITY_TYPES.includes(a.type) ? a.type : 'other';
    let when = a.date ? new Date(a.date) : new Date();
    if (isNaN(when) || when.getFullYear() < 2000 || when.getTime() > Date.now() + 366 * 864e5) when = new Date();
    await q.query('INSERT INTO candidate_activity (candidate_id, type, occurred_at, text, created_by) VALUES ($1,$2,$3,$4,$5)',
      [id, type, when, a.text.trim().slice(0, 4000), user.id]);
    n++;
  }
  return n;
}
async function addNotes(q, id, notes, user) {
  let n = 0;
  for (const note of (notes || []).slice(0, 20)) {
    if (!note || typeof note.text !== 'string' || !note.text.trim()) continue;
    await q.query('INSERT INTO candidate_notes (candidate_id, text, created_by) VALUES ($1,$2,$3)', [id, note.text.trim().slice(0, 8000), user.id]);
    n++;
  }
  return n;
}

async function touch(q, id, user) {
  await q.query('UPDATE candidates SET version = version + 1, updated_at = now(), updated_by = $2 WHERE id = $1', [id, user.id]);
}

/** Create a new candidate from a client object. Returns the new id. */
async function create(q, input, user, opts) {
  opts = opts || {};
  if (!input || typeof input !== 'object') throw badRequest('Invalid candidate.');
  const first = String(input.firstName || '').trim(); const last = String(input.lastName || '').trim();
  if (!first || !last) throw badRequest('First and family name are required.');
  const settings = Object.fromEntries((await q.query('SELECT key, value FROM settings')).rows.map((r) => [r.key, r.value]));
  let id = opts.keepId && /^[A-Z0-9]{1,6}-\d{1,8}$/.test(opts.keepId) ? opts.keepId : null;
  if (id && (await q.query('SELECT 1 FROM candidates WHERE id = $1 UNION SELECT 1 FROM candidate_deletions WHERE candidate_id = $1', [id])).rows.length) id = null;
  if (!id) {
    const prefix = String(settings.idPrefix || 'JRB').replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'JRB';
    for (;;) {
      const n = (await q.query("SELECT nextval('candidate_number_seq') AS n")).rows[0].n;
      id = prefix + '-' + String(n).padStart(4, '0');
      if (!(await q.query('SELECT 1 FROM candidates WHERE id = $1 UNION SELECT 1 FROM candidate_deletions WHERE candidate_id = $1', [id])).rows.length) break;
    }
  } else {
    const num = parseInt(id.split('-')[1], 10);
    await q.query("SELECT setval('candidate_number_seq', GREATEST((SELECT last_value FROM candidate_number_seq), $1))", [num]);
  }
  await q.query('INSERT INTO candidates (id, first_name, last_name, created_by, updated_by, created_at) VALUES ($1,$2,$3,$4,$4,COALESCE($5, now()))',
    [id, first, last, user.id, opts.createdAt || null]);
  // documents: defaults from document types, overridden by client values
  const types = (await q.query('SELECT key, required_default FROM document_types WHERE is_active')).rows;
  for (const t of types) {
    await q.query('INSERT INTO candidate_documents (candidate_id, doc_key, status, updated_by) VALUES ($1,$2,$3,$4)',
      [id, t.key, t.required_default ? 'missing' : 'not_required', user.id]);
  }
  await q.query('INSERT INTO contracts (candidate_id) VALUES ($1)', [id]);
  // Everything else is applied as changes from an empty record (validated the same way as edits).
  const blank = await get(id, q);
  const changes = [];
  const push = (path, to) => { if (to !== undefined && !same(getPath(blank, path), to)) changes.push({ path, from: getPath(blank, path), to }); };
  for (const path of Object.keys(SCALARS)) if (path !== 'firstName' && path !== 'lastName') push(path, input[path]);
  for (const path of Object.keys(LOOKUPS)) push(path, input[path]);
  push('recruiter', input.recruiter);
  push('followUpDate', input.followUpDate); push('followUpNote', input.followUpNote);
  if (input.documents && typeof input.documents === 'object') {
    for (const [key, d] of Object.entries(input.documents)) for (const f of Object.keys(DOC_FIELDS)) if (d && d[f] !== undefined) push(`documents.${key}.${f}`, d[f]);
  }
  if (input.contract && typeof input.contract === 'object') for (const f of Object.keys(CONTRACT_FIELDS)) push(`contract.${f}`, input.contract[f]);
  if (input.onboarding && typeof input.onboarding === 'object') {
    for (const [key, o] of Object.entries(input.onboarding)) if (o) { push(`onboarding.${key}.done`, !!o.done); push(`onboarding.${key}.date`, o.date || ''); }
  }
  if (opts.lenient) {
    // imports: skip values that fail validation instead of rejecting the whole candidate
    for (const ch of changes) { try { await q.query('SAVEPOINT imp'); await applyChanges(q, id, [ch], user, { skipConflictCheck: true }); await q.query('RELEASE SAVEPOINT imp'); } catch (e) { await q.query('ROLLBACK TO SAVEPOINT imp'); } }
  } else {
    await applyChanges(q, id, changes, user, { skipConflictCheck: true });
  }
  await addActivities(q, id, input.activities, user);
  await addNotes(q, id, input.noteLog, user);
  await q.query('UPDATE candidates SET version = 1 WHERE id = $1', [id]);
  return id;
}

module.exports = { list, get, create, applyChanges, addActivities, addNotes, touch, same, getPath, FOLLOW_TYPES, ACTIVITY_TYPES };
