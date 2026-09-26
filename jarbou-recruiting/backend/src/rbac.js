/* Role-based access control – enforced on the server for every API route. */
'use strict';
const { unauthorized, forbidden } = require('./errors');

const PERMISSIONS = {
  viewer: ['read'],
  recruiter: ['read', 'candidate.write', 'candidate.archive', 'attachment.read', 'attachment.write', 'export'],
  admin: ['read', 'candidate.write', 'candidate.archive', 'candidate.delete', 'attachment.read', 'attachment.write', 'export',
    'settings.write', 'users.manage', 'backup.manage', 'audit.read', 'import']
};

function permissionsFor(role) { return PERMISSIONS[role] ? PERMISSIONS[role].slice() : []; }
function can(user, perm) { return !!user && permissionsFor(user.role).includes(perm); }

/** Express middleware: 401 when not signed in, 403 when the role lacks the permission. */
function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user, perm)) return next(forbidden());
    next();
  };
}

module.exports = { PERMISSIONS, permissionsFor, can, requirePerm };
