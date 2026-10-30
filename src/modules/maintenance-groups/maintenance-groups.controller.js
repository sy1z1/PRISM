import * as service from './maintenance-groups.service.js';
import { assertAssetAccess, sendAuthorizationError } from '../authorization/resource-access.js';
import { ROLES } from '../authorization/policy.js';
import { recordAuditEvent } from '../audit/audit.model.js';

const VALID_LINK_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

const resolveOrganizationId = (req, suppliedOrganizationId) => {
  if (req.user?.role === ROLES.SUPER_ADMIN) {
    return suppliedOrganizationId || req.user.organizationId || null;
  }
  return req.user?.organizationId || null;
};

export const getAvailableGroups = async (req, res) => {
  try {
    const { assetId } = req.query;
    if (!assetId) {
      return res.status(400).json({ error: 'assetId query parameter is required.' });
    }
    await assertAssetAccess(req.user, assetId);
    const groups = await service.fetchAvailableGroups(assetId);
    res.status(200).json({ groups });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    if (error.message === 'ASSET_NOT_FOUND' || error.message === 'RESOURCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    console.error('Error fetching available groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listSupervisors = async (req, res) => {
  try {
    const supervisors = await service.fetchGroupSupervisors(req.params.groupId);
    res.status(200).json({ supervisors });
  } catch (error) {
    console.error('Error listing supervisors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addSupervisor = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body || {};
    const result = await service.grantSupervisor({
      groupId,
      userId,
      grantedBy: req.user.userId
    });

    if (!result.alreadyGranted) {
      await recordAuditEvent({
        actorId: req.user.userId,
        organizationId: req.user.organizationId ?? null,
        actionType: 'SUPERVISOR_GRANTED',
        resourceType: 'maintenance_group_supervisor',
        resourceId: result.id ?? null,
        metadata: { groupId, userId }
      });
    }

    res.status(result.alreadyGranted ? 200 : 201).json({ supervisor: result });
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Maintenance group not found.' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (error.message === 'USER_REQUIRED') {
      return res.status(400).json({ error: 'userId is required.' });
    }
    console.error('Error granting supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeSupervisor = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    await service.revokeSupervisor({ groupId, userId, revokedBy: req.user.userId });

    await recordAuditEvent({
      actorId: req.user.userId,
      organizationId: req.user.organizationId ?? null,
      actionType: 'SUPERVISOR_REVOKED',
      resourceType: 'maintenance_group_supervisor',
      resourceId: null,
      metadata: { groupId, userId }
    });

    res.status(200).json({ message: 'Supervisor authority revoked.' });
  } catch (error) {
    if (error.message === 'SUPERVISOR_NOT_FOUND') {
      return res.status(404).json({ error: 'Active supervisor authority not found.' });
    }
    console.error('Error revoking supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// D7: contractor handshake and ACTIVE/INACTIVE toggle.
export const getLinkedGroups = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query.organizationId);
    if (!organizationId) {
      return res.status(400).json({ error: 'ORGANIZATION_REQUIRED' });
    }
    const groups = await service.fetchLinkedGroups(organizationId);
    res.status(200).json({ organizationId, groups });
  } catch (error) {
    console.error('Error listing linked groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const linkGroup = async (req, res) => {
  try {
    const { groupCode, status = 'ACTIVE', organizationId: suppliedOrganizationId } = req.body || {};
    const organizationId = resolveOrganizationId(req, suppliedOrganizationId);

    if (!organizationId) {
      return res.status(400).json({ error: 'ORGANIZATION_REQUIRED' });
    }
    if (!VALID_LINK_STATUSES.has(status)) {
      return res.status(400).json({ error: 'INVALID_LINK_STATUS' });
    }

    const link = await service.linkGroup({ organizationId, groupCode, status });

    await recordAuditEvent({
      actorId: req.user.userId,
      organizationId,
      actionType: 'GROUP_LINKED',
      resourceType: 'organization_maintenance_group',
      resourceId: link.id,
      metadata: { groupId: link.group_id, groupCode, status }
    });

    res.status(200).json({ link });
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Maintenance group not found for that group code.' });
    }
    if (error.message === 'GROUP_CODE_REQUIRED') {
      return res.status(400).json({ error: 'groupCode is required.' });
    }
    console.error('Error linking group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateGroupLink = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { status, organizationId: suppliedOrganizationId } = req.body || {};
    const organizationId = resolveOrganizationId(req, suppliedOrganizationId);

    if (!organizationId) {
      return res.status(400).json({ error: 'ORGANIZATION_REQUIRED' });
    }
    if (!VALID_LINK_STATUSES.has(status)) {
      return res.status(400).json({ error: 'INVALID_LINK_STATUS' });
    }

    const link = await service.setGroupLinkStatus({ organizationId, groupId, status });

    await recordAuditEvent({
      actorId: req.user.userId,
      organizationId,
      actionType: status === 'ACTIVE' ? 'GROUP_LINK_ACTIVATED' : 'GROUP_LINK_DEACTIVATED',
      resourceType: 'organization_maintenance_group',
      resourceId: link.id,
      metadata: { groupId, status }
    });

    res.status(200).json({ link });
  } catch (error) {
    if (error.message === 'GROUP_LINK_NOT_FOUND') {
      return res.status(404).json({ error: 'This group is not linked to your organization.' });
    }
    console.error('Error updating group link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
