import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as identityModel from './identity.model.js';
import { isAccountActive, resolveSingleRole, ROLES } from '../authorization/policy.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_MIN_BYTES = 12;
const PASSWORD_MAX_BYTES = 72;

export const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length === 0) return 'PASSWORD_REQUIRED';
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < PASSWORD_MIN_BYTES) return 'PASSWORD_TOO_SHORT';
  if (bytes > PASSWORD_MAX_BYTES) return 'PASSWORD_TOO_LONG';
  return null;
};

const assertPassword = (password) => {
  const code = validatePassword(password);
  if (code) throw new Error(code);
};

export const createAdminProvisionedUser = async ({ email, password, role, organizationId = null }) => {
  assertPassword(password);
  const passwordHash = await bcrypt.hash(password, 12);
  return identityModel.provisionNewUser({ email, passwordHash, role, organizationId });
};

export const loginUser = async (email, plainTextPassword) => {
  const user = await identityModel.getUserByEmail(email);
  if (!user) {
    // Equalise timing with a real bcrypt comparison.
    await bcrypt.compare(plainTextPassword, '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
    throw new Error('INVALID_CREDENTIALS');
  }

  const isMatch = await bcrypt.compare(plainTextPassword, user.password_hash);
  if (!isMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!isAccountActive(user.acc_status)) {
    throw new Error('ACCOUNT_INACTIVE');
  }

  const roleResult = resolveSingleRole(user.roles);
  if (!roleResult.ok) {
    throw new Error(roleResult.reason);
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const payload = {
    userId: user.id,
    email: user.email,
    role: roleResult.role,
    sid: sessionId
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
    algorithm: 'HS256',
    issuer: 'prism',
    audience: 'prism-api'
  });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await identityModel.createSession({
    sessionId,
    userId: user.id,
    tokenHash,
    expiresAt
  });

  await identityModel.updateLastLogin(user.id);

  return token;
};

export const revokeCurrentSession = async ({ sessionId, userId }) => {
  if (!sessionId || !userId) {
    throw new Error('SESSION_CONTEXT_MISSING');
  }
  return await identityModel.revokeSession(sessionId, userId);
};

export const purgeOldSessions = () => identityModel.purgeExpiredSessions(30);

export const listUsers = () => identityModel.listUsers();

export const listOrganizations = () => identityModel.listOrganizations();

export const updateUser = async ({ userId, role, organizationId, accStatus }) =>
  identityModel.updateUser({ userId, role, organizationId, accStatus });

export const resetUserPassword = async (userId, password) => {
  assertPassword(password);
  const passwordHash = await bcrypt.hash(password, 12);
  return identityModel.resetUserPassword(userId, passwordHash);
};

export const ROLE_NAMES = Object.freeze({
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  COUNCIL_ADMIN: ROLES.COUNCIL_ADMIN,
  MAINTENANCE_WORKER: ROLES.MAINTENANCE_WORKER,
  DATA_ENTRY: ROLES.DATA_ENTRY
});
