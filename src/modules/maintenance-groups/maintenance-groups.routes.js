import { Router } from 'express';
import {
  getAvailableGroups,
  listSupervisors,
  addSupervisor,
  removeSupervisor,
  getLinkedGroups,
  linkGroup,
  updateGroupLink
} from './maintenance-groups.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { requireRole } from '../../middlewares/rbac.guard.js';
import { MANAGEMENT_ROLES, ROLES } from '../authorization/policy.js';

const router = Router();

// Management uses this to populate the group selector before creating a ticket.
router.get('/available', requireAuth, requireRole(MANAGEMENT_ROLES), getAvailableGroups);

// D7: contractor handshake by group_code + ACTIVE/INACTIVE toggle.
router.get('/linked', requireAuth, requireRole(MANAGEMENT_ROLES), getLinkedGroups);
router.post('/link', requireAuth, requireRole(MANAGEMENT_ROLES), linkGroup);
router.patch('/:groupId/link', requireAuth, requireRole(MANAGEMENT_ROLES), updateGroupLink);

// Supervisor authority administration is SuperAdmin-only.
router.get(
  '/:groupId/supervisors',
  requireAuth,
  requireRole([ROLES.SUPER_ADMIN]),
  listSupervisors
);
router.post(
  '/:groupId/supervisors',
  requireAuth,
  requireRole([ROLES.SUPER_ADMIN]),
  addSupervisor
);
router.delete(
  '/:groupId/supervisors/:userId',
  requireAuth,
  requireRole([ROLES.SUPER_ADMIN]),
  removeSupervisor
);

export default router;
