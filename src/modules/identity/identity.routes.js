import { Router } from 'express';
import { provisionUser, login } from './identity.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { requireRole } from '../../middlewares/rbac.guard.js';

const router = Router();

router.post('/provision', provisionUser);
router.post('/login', login);

router.get('/me', requireAuth, (req, res) => {
    res.status(200).json({
        user: req.user
    });
});

export default router;