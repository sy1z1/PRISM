import { getUserRoles, hasAnyRole } from '../modules/authorization/policy.js';

// Deny-by-default role gate. Roles come from the DB-resolved actor set by
// requireAuth, never from client input.
export const requireRole = (allowedRoles) => {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [];

  return (req, res, next) => {
    if (!req.user || getUserRoles(req.user).length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!hasAnyRole(req.user, allowed)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of the following roles: ${allowed.join(', ')}`
      });
    }

    return next();
  };
};
