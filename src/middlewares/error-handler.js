import multer from 'multer';
import { AuthorizationError } from '../modules/authorization/resource-access.js';
import { UploadError } from './upload.guard.js';

export const securityHeaders = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
};

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
};

export const errorHandler = (error, _req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof UploadError) {
    return res.status(error.status || 400).json({ error: error.code });
  }

  if (error instanceof multer.MulterError) {
    const code =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'FILE_TOO_LARGE'
        : error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'UNEXPECTED_FILE_FIELD'
          : 'UPLOAD_ERROR';
    return res.status(400).json({ error: code });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'INVALID_JSON' });
  }

  if (error instanceof AuthorizationError) {
    return res.status(error.status || 403).json({ error: error.code });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
};
