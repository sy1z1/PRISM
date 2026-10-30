import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as identityModel from './identity.model.js';
import { isAccountActive, resolveSingleRole } from '../authorization/policy.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const createAdminProvisionedUser = async (email, plainTestPassword) => {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(plainTestPassword, saltRounds);

    return await identityModel.provisionNewUser(email, passwordHash);
};

export const loginUser = async (email, plainTextPassword) => {
  const user = await identityModel.getUserByEmail(email);
  if (!user) {
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

  // Session id is embedded in the token so every request can validate the
  // session record (revocation, expiry) server-side.
  const payload = {
    userId: user.id,
    email: user.email,
    role: roleResult.role,
    sid: sessionId
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  // Deterministic hash allows future lookups; the raw token is never stored.
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

// Revokes the current session. The caller's session id comes from the
// server-validated auth context, never from the request body.
export const revokeCurrentSession = async ({ sessionId, userId }) => {
  if (!sessionId || !userId) {
    throw new Error('SESSION_CONTEXT_MISSING');
  }
  return await identityModel.revokeSession(sessionId, userId);
};
