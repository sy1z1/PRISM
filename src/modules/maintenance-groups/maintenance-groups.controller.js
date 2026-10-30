import * as service from './maintenance-groups.service.js';
import { assertAssetAccess, sendAuthorizationError } from '../authorization/resource-access.js';

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
    res.status(200).json({ message: 'Supervisor authority revoked.' });
  } catch (error) {
    if (error.message === 'SUPERVISOR_NOT_FOUND') {
      return res.status(404).json({ error: 'Active supervisor authority not found.' });
    }
    console.error('Error revoking supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
