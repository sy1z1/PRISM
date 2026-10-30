import * as identityService from './identity.service.js';

export const provisionUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const newUser = await identityService.createAdminProvisionedUser(email, password);
    res.status(201).json({
      message: 'User provisioned successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Provisioning error:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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
    // Session identity comes only from requireAuth's server-validated context.
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