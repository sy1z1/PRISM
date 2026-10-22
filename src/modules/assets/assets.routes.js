import { Router } from 'express';
import {
  getDigitalTwinView,
  upload360Capture,
  saveHotspot,
  deleteHotspot,
  toggleIgnoreWarning
} from './assets.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { upload } from '../../middlewares/upload.guard.js';

const router = Router();

// 1. Fetch complete Digital Twin page payload (supports ?captureId=... or ?targetDate=...)
router.get('/:assetId/digital-twin', requireAuth, getDigitalTwinView);

// 2. Upload a 360° image for an asset (Multer field name MUST be 'image360')
router.post('/:assetId/captures', requireAuth, upload.single('image360'), upload360Capture);

// 3. Manually place or update a hotspot on a 360° image
router.post('/captures/:captureId/hotspots', requireAuth, saveHotspot);

// 4. Delete a hotspot
router.delete('/hotspots/:hotspotId', requireAuth, deleteHotspot);

// 5. Dismiss (or re-enable) the "missing hotspots" soft warning on a 360° capture
router.patch('/captures/:captureId/ignore-warning', requireAuth, toggleIgnoreWarning);

export default router;