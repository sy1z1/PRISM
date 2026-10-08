import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as identityModel from './identity.model.js';

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

  const payload = { userId: user.id, email: user.email, role: user.role_name };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await identityModel.createSession(user.id, tokenHash, expiresAt);

  await identityModel.updateLastLogin(user.id);

  return token;
};