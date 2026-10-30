import * as identityService from './identity.service.js';
import { recordAuditEvent } from '../audit/audit.model.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const respondKnownError = (res, error) => {
  const known = {
    PASSWORD_REQUIRED: [400, 'A password is required.'],
    PASSWORD_TOO_SHORT: [400, 'Password must be at least 12 characters.'],
    PASSWORD_TOO_LONG: [400, 'Password must be at most 72 bytes.'],
    ROLE_REQUIRED: [400, 'A role is required.'],
    ROLE_INVALID: [400, 'The requested role is not valid.'],
    ORGANIZATION_REQUIRED: [400, 'This role requires an organization.'],
    ORGANIZATION_NOT_FOUND: [404, 'Organization not found.'],
    ORGANIZATION_NOT_ALLOWED: [400, 'SuperAdmin must not be bound to an organization.'],
    INVALID_ACCOUNT_STATUS: [400, 'Invalid account status.'],
    USER_NOT_FOUND: [404, 'User not found.']
  };
  if (known[error.message]) {
    const [status, message] = known[error.message];
    res.status(status).json({ error: error.message, message });
    return true;
  }
  return false;
};

export const provisionUser = async (req, res) => {
  try {
    const { email, password, role, organizationId = null } = req.body || {};

    if (!email || !EMAIL_PATTERN.test(String(email))) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!role) {
      return res.status(400).json({ error: 'A role is required.' });
    }

    const newUser = await identityService.createAdminProvisionedUser({
      email,
      password,
      role,
      organizationId
    });

    await recordAuditEvent({
      actorId: req.user.userId,
      organizationId: organizationId ?? null,
      actionType: 'USER_PROVISIONED',
      resourceType: 'user',
      resourceId: newUser.id,
      metadata: { email, role }
    });

    res.status(201).json({
      message: 'User provisioned successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Provisioning error:', error.message);

    if (error.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    if (respondKnownError(res, error)) return;
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const listUsers = async (_req, res) => {
  try {
    const users = await identityService.listUsers();
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const listOrganizations = async (_req, res) => {
  try {
    const organizations = await identityService.listOrganizations();
    res.status(200).json({ organizations });
  } catch (error) {
    console.error('Error listing organizations:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, organizationId, accStatus } = req.body || {};

    if (role === undefined && organizationId === undefined && accStatus === undefined) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const user = await identityService.updateUser({ userId, role, organizationId, accStatus });

    await recordAuditEvent({
      actorId: req.user.userId,
      organizationId: user?.organization_id ?? null,
      actionType: 'USER_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { role: role ?? null, accStatus: accStatus ?? null }
    });

    res.status(200).json({ user });
  } catch (error) {
    if (respondKnownError(res, error)) return;
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body || {};

    await identityService.resetUserPassword(userId, password);

    await recordAuditEvent({
      actorId: req.user.userId,
      organizationId: null,
      actionType: 'USER_PASSWORD_RESET',
      resourceType: 'user',
      resourceId: userId,
      metadata: {}
    });

    res.status(200).json({ message: 'Password reset. Existing sessions were revoked.' });
  } catch (error) {
    if (respondKnownError(res, error)) return;
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const token = await identityService.loginUser(email, password);

    res.status(200).json({
      message: 'Login successful',
      token: token
    });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (error.message === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({ error: 'This account is not active.' });
    }
    if (error.message === 'AMBIGUOUS_ROLE' || error.message === 'NO_ROLE_ASSIGNED') {
      return res.status(403).json({
        error: 'Your account does not have a single authorized role. Contact a SuperAdmin.'
      });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Factory allows the revoke collaborator to be injected for tests.
export const createLogoutHandler = ({ revokeSession }) => async (req, res) => {
  try {
    const sessionId = req.auth?.sessionId;
    const userId = req.user?.userId;

    if (!sessionId || !userId) {
      return res.status(401).json({ error: 'Unauthorized: No active session' });
    }

    const revoked = await revokeSession({ sessionId, userId });

    return res.status(200).json({
      message: revoked ? 'Logged out successfully.' : 'Session is already inactive.'
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const logout = createLogoutHandler({
  revokeSession: identityService.revokeCurrentSession
});
