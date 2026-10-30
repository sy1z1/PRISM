import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { assertFileAccess, sendAuthorizationError } from '../authorization/resource-access.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads');
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

const serveFile = async (req, res, { kind, relativePath, storedUrl }) => {
  const fileName = path.basename(relativePath);

  if (!SAFE_FILENAME.test(fileName)) {
    return res.status(400).json({ error: 'Invalid file name.' });
  }

  const absolutePath = path.resolve(UPLOADS_ROOT, relativePath);
  if (absolutePath !== path.join(UPLOADS_ROOT, relativePath) || !absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return res.status(400).json({ error: 'Invalid file path.' });
  }

  await assertFileAccess(req.user, kind, storedUrl);

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  return res.sendFile(absolutePath);
};

// Evidence uploaded against a ticket (BEFORE / AFTER photos).
export const getTicketEvidence = async (req, res) => {
  try {
    const { filename } = req.params;
    await serveFile(req, res, {
      kind: 'ticket',
      relativePath: path.join('tickets', filename),
      storedUrl: `/uploads/tickets/${filename}`
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error('Error serving ticket evidence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 360-degree asset captures.
export const getAssetCapture = async (req, res) => {
  try {
    const { filename } = req.params;
    await serveFile(req, res, {
      kind: 'capture',
      relativePath: path.join('assets', '360', filename),
      storedUrl: `/uploads/assets/360/${filename}`
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error('Error serving asset capture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Asset thumbnails.
export const getAssetThumbnail = async (req, res) => {
  try {
    const { filename } = req.params;
    await serveFile(req, res, {
      kind: 'asset',
      relativePath: path.join('assets', 'thumbnails', filename),
      storedUrl: `/uploads/assets/thumbnails/${filename}`
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error('Error serving asset thumbnail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
