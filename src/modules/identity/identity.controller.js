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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};