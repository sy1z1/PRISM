import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { UPLOADS_ROOT } from '../config/paths.js';

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = Object.freeze({
  ticketMedia: 10 * MB,
  thumbnails: 10 * MB,
  thumbnail: 10 * MB,
  image360: 25 * MB
});

// Only these image types are accepted. The extension is derived from the
// detected magic bytes, never from the client-supplied file name.
const ALLOWED_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
});

const DESTINATIONS = Object.freeze({
  ticketMedia: 'tickets',
  image360: path.join('assets', '360'),
  thumbnails: path.join('assets', 'thumbnails'),
  thumbnail: path.join('assets', 'thumbnails')
});

export class UploadError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'UploadError';
    this.code = code;
    this.status = status;
  }
}

export const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Could not remove upload:', error.message);
    }
  }
};

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const relativeDir = DESTINATIONS[file.fieldname];
    if (!relativeDir) return cb(new UploadError('UNEXPECTED_FILE_FIELD'));
    const dir = path.join(UPLOADS_ROOT, relativeDir);
    fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir)).catch(cb);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.upload`);
  }
});

const uploader = multer({
  storage,
  limits: {
    files: 1,
    // Global ceiling; per-field limits are enforced after upload.
    fileSize: UPLOAD_LIMITS.image360
  },
  fileFilter: (_req, file, cb) => {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME, file.mimetype)) {
      return cb(new UploadError('UNSUPPORTED_MEDIA_TYPE'));
    }
    cb(null, true);
  }
});

export const upload = uploader;

const readMagic = async (filePath) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, 12, 0);
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', extension: '.jpg' };
    }
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.subarray(0, 8).equals(png)) {
      return { mime: 'image/png', extension: '.png' };
    }
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { mime: 'image/webp', extension: '.webp' };
    }
    return null;
  } finally {
    await handle.close();
  }
};

// Runs after multer. Verifies declared MIME against actual magic bytes,
// enforces the per-field size limit, renames to a safe canonical extension,
// and deletes the file on any failure.
export const validateUploadedImage = async (req, res, next) => {
  if (!req.file) return next();

  const file = req.file;
  try {
    const maxBytes = UPLOAD_LIMITS[file.fieldname] ?? UPLOAD_LIMITS.ticketMedia;
    if (file.size > maxBytes) {
      await safeUnlink(file.path);
      return res.status(400).json({ error: 'FILE_TOO_LARGE' });
    }

    const detected = await readMagic(file.path);
    if (!detected || ALLOWED_MIME[file.mimetype] !== detected.extension) {
      await safeUnlink(file.path);
      return res.status(400).json({ error: 'INVALID_IMAGE_FILE' });
    }

    const base = path.basename(file.filename, '.upload');
    const finalName = `${base}${detected.extension}`;
    const finalPath = path.join(path.dirname(file.path), finalName);
    await fs.rename(file.path, finalPath);

    file.filename = finalName;
    file.path = finalPath;
    file.mimetype = detected.mime;

    next();
  } catch (error) {
    await safeUnlink(file.path);
    next(error);
  }
};

// Controllers call this on every failure after multer wrote a file.
export const cleanupUpload = async (req) => {
  if (req.file?.path) await safeUnlink(req.file.path);
};
