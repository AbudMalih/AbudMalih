/* Audit log (admin, read-only) and recent activity feed (all roles). */
'use strict';
const express = require('express');
const db = require('./db');
const { requirePerm } = require('./rbac');
const { wrap } = require('./errors');

const auditRouter = express.Router();
auditRouter.get('/', requirePerm('audit.read'), wrap(async (req, res) => {
  const where = []; const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', '$' + params.length)); };
  if (req.query.candidate) add('candidate_id = ?', String(req.query.candidate));
  if (req.query.actor) add('actor_id::text = ?', String(req.query.actor));
  if (req.query.action) add('action LIKE ?', String(req.query.action).replace(/[%_]/g, '') + '%');
  if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) add('occurred_at >= ?::date', req.query.from);
  if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) add("occurred_at < (?::date + interval '1 day')", req.query.to);
  if (req.query.q) add('(summary ILIKE ? OR actor_name ILIKE $' + (params.length + 1) + ' OR candidate_id ILIKE $' + (params.length + 1) + ')', '%' + String(req.query.q).slice(0, 80).replace(/[%_\\]/g, '') + '%');
  const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const [rows, total] = await Promise.all([
    db.query(`SELECT id, occurred_at, actor_name, actor_role, action, entity_type, entity_id, candidate_id, summary, changes FROM audit_logs${w} ORDER BY occurred_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    db.query(`SELECT count(*)::int AS n FROM audit_logs${w}`, params)
  ]);
  const actors = (await db.query('SELECT id, full_name FROM users ORDER BY full_name')).rows;
  res.json({ items: rows.rows, total: total.rows[0].n, limit, offset, actors });
}));

const activityRouter = express.Router();
activityRouter.get('/recent', requirePerm('read'), wrap(async (req, res) => {
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 12));
  const r = await db.query(`SELECT a.id, a.candidate_id, a.type, a.text, a.created_at, u.full_name AS by, c.first_name, c.last_name
    FROM candidate_activity a JOIN candidates c ON c.id = a.candidate_id LEFT JOIN users u ON u.id = a.created_by
    ORDER BY a.created_at DESC LIMIT ${limit}`);
  res.json(r.rows.map((x) => ({ id: x.id, candidateId: x.candidate_id, candidate: x.first_name + ' ' + x.last_name, type: x.type, text: x.text, date: x.created_at, by: x.by || '' })));
}));

module.exports = { auditRouter, activityRouter };
