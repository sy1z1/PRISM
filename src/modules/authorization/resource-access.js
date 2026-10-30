import * as authzModel from './authorization.model.js';
import {
  canAccessOrganization,
  canReadTicket,
  isManagementUser,
  isSuperAdmin,
  selfVerificationViolation
} from './policy.js';

export class AuthorizationError extends Error {
  constructor(code, status = 403) {
    super(code);
    this.name = 'AuthorizationError';
    this.code = code;
    this.status = status;
  }
}

export const sendAuthorizationError = (res, error) => {
  if (error instanceof AuthorizationError) {
    return res.status(error.status).json({ error: error.code });
  }
  return null;
};

const assertOrg = (user, organizationId) => {
  if (!canAccessOrganization(user, organizationId)) {
    throw new AuthorizationError('ORGANIZATION_ACCESS_DENIED');
  }
};

export const assertAssetAccess = async (user, assetId) => {
  const row = await authzModel.getAssetOrg(assetId);
  if (!row) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  assertOrg(user, row.organization_id);
  return row;
};

export const assertSiteAccess = async (user, siteId) => {
  const row = await authzModel.getSiteOrg(siteId);
  if (!row) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  assertOrg(user, row.organization_id);
  return row;
};

export const assertTicketAccess = async (user, ticketId) => {
  const row = await authzModel.getTicketMeta(ticketId);
  if (!row) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  assertOrg(user, row.organization_id);
  return row;
};

export const assertCaptureAccess = async (user, captureId) => {
  const row = await authzModel.getCaptureOrg(captureId);
  if (!row) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  assertOrg(user, row.organization_id);
  return row;
};

export const assertHotspotAccess = async (user, hotspotId) => {
  const row = await authzModel.getHotspotOrg(hotspotId);
  if (!row) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  assertOrg(user, row.organization_id);
  return row;
};

export const assertAssignedToTicket = async (user, ticketId) => {
  if (isSuperAdmin(user)) return;
  const assigned = await authzModel.isAssignedToTicket(ticketId, user.userId);
  if (!assigned) throw new AuthorizationError('NOT_ASSIGNED_TO_TICKET');
};

// Supervisor authority for the new group workflow. There is deliberately no
// SuperAdmin bypass: SuperAdmin must be explicitly granted supervisor authority
// to act on a group's tickets.
export const assertSupervisesTicketGroup = async (user, ticketMeta) => {
  if (!ticketMeta || !ticketMeta.maintenance_group_id) {
    throw new AuthorizationError('NOT_GROUP_SUPERVISOR');
  }
  const isSupervisor = await authzModel.isActiveSupervisorOfGroup(
    user.userId,
    ticketMeta.maintenance_group_id
  );
  if (!isSupervisor) {
    throw new AuthorizationError('NOT_GROUP_SUPERVISOR');
  }

  // D1: the ticket's organization must have an ACTIVE link to the group.
  const linked = await authzModel.isSupervisorLinkedToTicketOrg(
    user.userId,
    ticketMeta.maintenance_group_id,
    ticketMeta.organization_id
  );
  if (!linked) {
    throw new AuthorizationError('NOT_GROUP_SUPERVISOR');
  }
};

export const assertTicketReadAccess = async (user, ticketMeta) => {
  if (!ticketMeta) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  if (isManagementUser(user)) {
    assertOrg(user, ticketMeta.organization_id);
    return;
  }
  const groupIds = await authzModel.getSupervisorGroupIds(user.userId);
  if (!canReadTicket(user, {
    organizationId: ticketMeta.organization_id,
    maintenanceGroupId: ticketMeta.maintenance_group_id
  }, groupIds)) {
    throw new AuthorizationError('TICKET_ACCESS_DENIED');
  }

  const linked = await authzModel.isSupervisorLinkedToTicketOrg(
    user.userId,
    ticketMeta.maintenance_group_id,
    ticketMeta.organization_id
  );
  if (!linked) {
    throw new AuthorizationError('TICKET_ACCESS_DENIED');
  }
};

export const assertTicketReadableById = async (user, ticketId) => {
  const meta = await authzModel.getTicketMeta(ticketId);
  if (!meta) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);
  await assertTicketReadAccess(user, meta);
  return meta;
};

// Management: null (all tickets in org). Supervisors: their active group ids.
export const getReadableGroupFilter = async (user) => {
  if (isManagementUser(user)) return null;
  return await authzModel.getSupervisorGroupIds(user.userId);
};

export const assertNotSelfVerification = async (user, ticketMeta) => {
  if (!ticketMeta) return;
  const [assigneeIds, priorVerifierIds] = await Promise.all([
    authzModel.getAssigneeIds(ticketMeta.id),
    authzModel.getPriorVerifierIds(ticketMeta.id)
  ]);
  if (selfVerificationViolation(user, ticketMeta, assigneeIds, priorVerifierIds)) {
    throw new AuthorizationError('SELF_VERIFICATION_FORBIDDEN');
  }
};

export const assertFileAccess = async (user, kind, identifier) => {
  let row = null;
  if (kind === 'ticket') {
    row = await authzModel.getTicketMediaOrgByUrl(identifier);
  } else if (kind === 'capture') {
    row = await authzModel.getCaptureOrgByUrl(identifier);
  } else if (kind === 'asset') {
    row = await authzModel.getAssetOrgByImageUrl(identifier);
  }
  if (!row) throw new AuthorizationError('RESOURCE_NOT_FOUND', 404);

  if (kind === 'ticket' && !isManagementUser(user)) {
    // Non-management users may only read evidence for tickets they supervise
    // and whose organization has an ACTIVE link to the group.
    const isSupervisor = await authzModel.isActiveSupervisorOfGroup(
      user.userId,
      row.maintenance_group_id
    );
    if (!isSupervisor) throw new AuthorizationError('ORGANIZATION_ACCESS_DENIED');

    const linked = await authzModel.isSupervisorLinkedToTicketOrg(
      user.userId,
      row.maintenance_group_id,
      row.organization_id
    );
    if (!linked) throw new AuthorizationError('ORGANIZATION_ACCESS_DENIED');

    return row;
  }

  assertOrg(user, row.organization_id);
  return row;
};
