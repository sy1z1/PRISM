import { Router } from 'express';
import { getRegions, getMacroData, getMicroData, uploadThumbnail } from './sites.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { requireRole } from '../../middlewares/rbac.guard.js';
import { upload } from '../../middlewares/upload.guard.js';
import { TWIN_EDITOR_ROLES } from '../authorization/policy.js';

const router = Router();

router.get('/regions', requireAuth, getRegions);
router.get('/macro', requireAuth, getMacroData);
router.get('/:siteId/assets', requireAuth, getMicroData);

router.post(
  '/assets/:assetId/thumbnails',
  requireAuth,
  requireRole(TWIN_EDITOR_ROLES),
  upload.single('thumbnails'),
  uploadThumbnail
);

export default router;
