/* Append-only audit log (the table rejects UPDATE/DELETE at database level). */
'use strict';
const db = require('./db');

/**
 * @param {object} q        pg client or pool (use the transaction client when inside a transaction)
 * @param {object} req      express request (for actor) or null for system events
 * @param {object} entry    { action, entityType, entityId, candidateId, summary, changes }
 */
async function write(q, req, entry) {
  const user = req && req.user;
  await (q || db).query(
    `INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, candidate_id, summary, changes, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [user ? user.id : null, user ? user.full_name : (entry.actorName || 'System'), user ? user.role : 'system',
      entry.action, entry.entityType, entry.entityId || null, entry.candidateId || null, (entry.summary || '').slice(0, 500),
      entry.changes ? JSON.stringify(entry.changes) : null, req ? clientIp(req) : null]
  );
}

function clientIp(req) {
  return (req.ip || '').replace(/^::ffff:/, '') || null;
}

module.exports = { write, clientIp };
