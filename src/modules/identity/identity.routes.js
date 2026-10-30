import { Router } from 'express';
import {
  provisionUser,
  login,
  logout,
  listUsers,
  listOrganizations,
  updateUser,
  resetUserPassword
} from './identity.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { requireRole } from '../../middlewares/rbac.guard.js';
import { loginRateLimit } from '../../middlewares/rate-limit.js';
import { ROLES } from '../authorization/policy.js';

const router = Router();

// Only SuperAdmin may administer accounts.
router.post('/provision', requireAuth, requireRole([ROLES.SUPER_ADMIN]), provisionUser);
router.get('/users', requireAuth, requireRole([ROLES.SUPER_ADMIN]), listUsers);
router.get('/organizations', requireAuth, requireRole([ROLES.SUPER_ADMIN]), listOrganizations);
router.patch('/users/:userId', requireAuth, requireRole([ROLES.SUPER_ADMIN]), updateUser);
router.post(
  '/users/:userId/reset-password',
  requireAuth,
  requireRole([ROLES.SUPER_ADMIN]),
  resetUserPassword
);

router.post('/login', loginRateLimit(), login);

// Revokes only the authenticated caller's current session.
router.post('/logout', requireAuth, logout);

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    user: req.user
  });
});

export default router;
