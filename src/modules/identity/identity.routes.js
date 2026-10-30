import { Router } from 'express';
import { provisionUser, login, logout } from './identity.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { requireRole } from '../../middlewares/rbac.guard.js';
import { ROLES } from '../authorization/policy.js';

const router = Router();

// Only SuperAdmin may create accounts.
router.post('/provision', requireAuth, requireRole([ROLES.SUPER_ADMIN]), provisionUser);
router.post('/login', login);

// Revokes only the authenticated caller's current session.
router.post('/logout', requireAuth, logout);

router.get('/me', requireAuth, (req, res) => {
    res.status(200).json({
        user: req.user
    });
});

export default router;
