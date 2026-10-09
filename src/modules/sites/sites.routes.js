import { Router } from 'express';
import { getRegions, getMacroData, getMicroData } from './sites.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';

const router = Router();

router.get('/regions', requireAuth, getRegions);
router.get('/macro', requireAuth, getMacroData);
router.get('/:siteId/assets', requireAuth, getMicroData);

export default router;