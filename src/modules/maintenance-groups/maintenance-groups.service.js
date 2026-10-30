import * as model from './maintenance-groups.model.js';

export const fetchAvailableGroups = async (assetId) => {
  if (!assetId) throw new Error('ASSET_ID_REQUIRED');
  return await model.getAvailableGroupsForAsset(assetId);
};

export const fetchGroupSupervisors = async (groupId) => {
  return await model.getGroupSupervisors(groupId);
};

export const grantSupervisor = async ({ groupId, userId, grantedBy }) => {
  if (!userId) throw new Error('USER_REQUIRED');
  return await model.grantGroupSupervisor({ groupId, userId, grantedBy });
};

export const revokeSupervisor = async ({ groupId, userId, revokedBy }) => {
  const revoked = await model.revokeGroupSupervisor({ groupId, userId, revokedBy });
  if (!revoked) throw new Error('SUPERVISOR_NOT_FOUND');
  return revoked;
};

export const fetchLinkedGroups = async (organizationId) => {
  return await model.getLinkedGroups(organizationId);
};

export const linkGroup = async ({ organizationId, groupCode, status }) => {
  if (!groupCode) throw new Error('GROUP_CODE_REQUIRED');
  return await model.linkGroupByCode({ organizationId, groupCode, status });
};

export const setGroupLinkStatus = async ({ organizationId, groupId, status }) => {
  const updated = await model.updateGroupLinkStatus({ organizationId, groupId, status });
  if (!updated) throw new Error('GROUP_LINK_NOT_FOUND');
  return updated;
};
