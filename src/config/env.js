import 'dotenv/config';

const REQUIRED = ['PG_USER', 'PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_PASSWORD', 'JWT_SECRET'];

// Fail fast on startup. Called by server.js only, so unit tests that import
// models do not require a live environment.
export const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }
};

export const PORT = Number(process.env.PORT) || 3000;
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
