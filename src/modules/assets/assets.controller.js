import * as assetsService from './assets.service.js';
import * as assetsModel from './assets.model.js';
import {
  assertAssetAccess,
  assertCaptureAccess,
  assertHotspotAccess,
  sendAuthorizationError
} from '../authorization/resource-access.js';

// 1. GET /api/assets/:assetId/digital-twin
export const getDigitalTwinView = async (req, res) => {
  try {
    const { assetId } = req.params;
    const { captureId, targetDate } = req.query;

    await assertAssetAccess(req.user, assetId);

    const data = await assetsService.fetchDigitalTwinData(assetId, { captureId, targetDate });
    res.status(200).json(data);
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    if (error.message === 'ASSET_NOT_FOUND') {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    console.error('Error fetching digital twin view:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. POST /api/assets/:assetId/captures (Uploads 360 Panorama)
export const upload360Capture = async (req, res) => {
  try {
    const { assetId } = req.params;
    const { capturedAt } = req.body;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No 360 image file provided.' });
    }

    await assertAssetAccess(req.user, assetId);

    const asset = await assetsModel.getAssetWithSiteDetails(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    const local360Url = `/uploads/assets/360/${req.file.filename}`;
    const newCapture = await assetsModel.createAssetCapture(assetId, local360Url, userId, capturedAt);

    res.status(201).json({
      message: '360° capture uploaded successfully!',
      capture: newCapture
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error('Error uploading 360 capture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. POST /api/assets/captures/:captureId/hotspots (Manual Hotspot Placement)
export const saveHotspot = async (req, res) => {
  try {
    const { captureId } = req.params;
    const { targetAssetId, pitch, yaw } = req.body;
    const userId = req.user.userId;

    if (!targetAssetId || pitch === undefined || yaw === undefined) {
      return res.status(400).json({ error: 'targetAssetId, pitch, and yaw are required.' });
    }

    const numPitch = parseFloat(pitch);
    const numYaw = parseFloat(yaw);

    if (isNaN(numPitch) || numPitch < -90 || numPitch > 90) {
      return res.status(400).json({ error: 'Pitch must be a valid angle between -90 and 90.' });
    }
    if (isNaN(numYaw) || numYaw < -180 || numYaw > 180) {
      return res.status(400).json({ error: 'Yaw must be a valid angle between -180 and 180.' });
    }

    await assertCaptureAccess(req.user, captureId);
    await assertAssetAccess(req.user, targetAssetId);

    const hotspot = await assetsService.addOrUpdateHotspot(captureId, {
      targetAssetId,
      pitch: numPitch,
      yaw: numYaw,
      userId
    });

    res.status(200).json({
      message: 'Hotspot saved successfully!',
      hotspot
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    if (error.message === 'CAPTURE_NOT_FOUND') {
      return res.status(404).json({ error: 'Source 360 capture not found.' });
    }
    if (error.message === 'TARGET_ASSET_NOT_FOUND') {
      return res.status(404).json({ error: 'Target asset not found.' });
    }
    if (error.message === 'CANNOT_LINK_SELF') {
      return res.status(400).json({ error: 'An asset capture cannot place a hotspot pointing to itself.' });
    }
    if (error.message === 'CROSS_SITE_HOTSPOT_NOT_ALLOWED') {
      return res.status(400).json({ error: 'Target asset must belong to the same playground site.' });
    }
    console.error('Error saving hotspot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. DELETE /api/assets/hotspots/:hotspotId
export const deleteHotspot = async (req, res) => {
  try {
    const { hotspotId } = req.params;

    await assertHotspotAccess(req.user, hotspotId);

    const deleted = await assetsModel.removeHotspot(hotspotId);

    if (!deleted) {
      return res.status(404).json({ error: 'Hotspot not found.' });
    }

    res.status(200).json({ message: 'Hotspot removed successfully.' });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error('Error deleting hotspot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 5. PATCH /api/assets/captures/:captureId/ignore-warning
export const toggleIgnoreWarning = async (req, res) => {
  try {
    const { captureId } = req.params;
    const { ignore } = req.body;

    await assertCaptureAccess(req.user, captureId);

    const ignoreBool = ignore !== undefined ? Boolean(ignore) : true;
    const updated = await assetsModel.setCaptureWarningIgnore(captureId, ignoreBool);

    if (!updated) {
      return res.status(404).json({ error: 'Capture not found.' });
    }

    res.status(200).json({
      message: ignoreBool
        ? 'Missing hotspot warning permanently dismissed for this 360° capture.'
        : 'Missing hotspot warning re-enabled for this 360° capture.',
      capture: updated
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error('Error updating warning preference:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
