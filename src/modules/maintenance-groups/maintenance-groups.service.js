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
