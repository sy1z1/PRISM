import { Router } from 'express';
import {
  getTicketEvidence,
  getAssetCapture,
  getAssetThumbnail
} from './files.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';

const router = Router();

// Authenticated, organization-scoped access to uploaded evidence.
// Stored URLs remain /uploads/... for backward compatibility; this API is the
// authorization-enforcing delivery path.
router.get('/tickets/:filename', requireAuth, getTicketEvidence);
router.get('/assets/360/:filename', requireAuth, getAssetCapture);
router.get('/assets/thumbnails/:filename', requireAuth, getAssetThumbnail);

export default router;
