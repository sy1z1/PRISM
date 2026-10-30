// Pure authorization policy helpers. No database or Express dependencies so they
// can be unit-tested in isolation.

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SuperAdmin',
  COUNCIL_ADMIN: 'Council Admin',
  MAINTENANCE_WORKER: 'Maintenance Worker',
  DATA_ENTRY: 'Data Entry'
});

export const MANAGEMENT_ROLES = Object.freeze([ROLES.COUNCIL_ADMIN, ROLES.SUPER_ADMIN]);
export const FIELD_ROLES = Object.freeze([ROLES.MAINTENANCE_WORKER, ROLES.SUPER_ADMIN]);
export const TWIN_EDITOR_ROLES = Object.freeze([
  ROLES.DATA_ENTRY,
  ROLES.COUNCIL_ADMIN,
  ROLES.SUPER_ADMIN
]);

const ACTIVE_ACCOUNT_STATUS = 'active';

export const normalizeText = (value) =>
  value === null || value === undefined ? '' : String(value).trim();

export const isAccountActive = (accStatus) =>
  normalizeText(accStatus).toLowerCase() === ACTIVE_ACCOUNT_STATUS;

export const getUserRoles = (user) => {
  if (!user) return [];
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const withPrimary = user.role ? [...roles, user.role] : roles;
  return [...new Set(withPrimary.map(normalizeText).filter(Boolean))];
};

export const hasAnyRole = (user, allowedRoles) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return false;
  const roles = getUserRoles(user);
  return allowedRoles.some((role) => roles.includes(role));
};

export const isSuperAdmin = (user) => hasAnyRole(user, [ROLES.SUPER_ADMIN]);

export const isManagementUser = (user) => hasAnyRole(user, MANAGEMENT_ROLES);

// Read access: management/verifier roles are org-scoped; any other account must
// be an active supervisor of the ticket's group.
export const canReadTicket = (user, ticket, supervisorGroupIds = []) => {
  if (!user || !ticket) return false;
  if (isManagementUser(user)) {
    return canAccessOrganization(user, ticket.organizationId);
  }
  const groupId = normalizeText(ticket.maintenanceGroupId);
  if (!groupId) return false;
  return Array.isArray(supervisorGroupIds) && supervisorGroupIds.includes(groupId);
};

export const resolveSingleRole = (roles) => {
  const unique = [...new Set((Array.isArray(roles) ? roles : []).map(normalizeText).filter(Boolean))];
  if (unique.length === 1) return { ok: true, role: unique[0] };
  if (unique.length === 0) return { ok: false, reason: 'NO_ROLE_ASSIGNED' };
  return { ok: false, reason: 'AMBIGUOUS_ROLE' };
};

export const canAccessOrganization = (user, organizationId) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const actorOrg = normalizeText(user.organizationId);
  const targetOrg = normalizeText(organizationId);
  if (!actorOrg || !targetOrg) return false;
  return actorOrg === targetOrg;
};

// Returns the organization filter a query should apply, or null for cross-org
// (SuperAdmin) access.
export const getOrganizationScope = (user) => {
  if (!user) return undefined;
  if (isSuperAdmin(user)) return null;
  const org = normalizeText(user.organizationId);
  return org || undefined;
};

export const evaluateSession = (session, now = new Date()) => {
  if (!session) return { ok: false, reason: 'SESSION_NOT_FOUND' };
  if (session.revoked_at) return { ok: false, reason: 'SESSION_REVOKED' };
  if (!session.expires_at) return { ok: false, reason: 'SESSION_EXPIRED' };
  if (new Date(session.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: 'SESSION_EXPIRED' };
  }
  if (!isAccountActive(session.acc_status)) {
    return { ok: false, reason: 'ACCOUNT_INACTIVE' };
  }
  return { ok: true };
};

export const isSelfVerification = (
  actorId,
  { reportedBy, assigneeIds, acknowledgedBy, completedBy, verifiedBy, verifiedByIds } = {},
  { ignoreReportedBy = false } = {}
) => {
  const actor = normalizeText(actorId);
  if (!actor) return false;
  const involved = [
    ...(ignoreReportedBy ? [] : [reportedBy]),
    acknowledgedBy,
    completedBy,
    verifiedBy,
    ...(Array.isArray(verifiedByIds) ? verifiedByIds : []),
    ...(Array.isArray(assigneeIds) ? assigneeIds : [])
  ].map(normalizeText);
  return involved.includes(actor);
};

// Management may verify a ticket they reported, but remains blocked if they
// performed contractor work (assignee/acknowledger/completer) or previously
// verified it. Supervisors never get the reporter exemption.
export const selfVerificationViolation = (
  user,
  ticketMeta = {},
  assigneeIds = [],
  priorVerifierIds = []
) =>
  isSelfVerification(
    user?.userId,
    {
      reportedBy: ticketMeta.reported_by,
      acknowledgedBy: ticketMeta.acknowledged_by,
      completedBy: ticketMeta.completed_by,
      verifiedBy: ticketMeta.verified_by,
      assigneeIds,
      verifiedByIds: priorVerifierIds
    },
    { ignoreReportedBy: isManagementUser(user) }
  );

export const toActor = (session) => {
  const roles = getUserRoles({ roles: session.roles });
  return {
    userId: session.user_id,
    email: session.email,
    role: roles[0] || null,
    roles,
    organizationId: session.organization_id || null,
    accStatus: session.acc_status
  };
};
