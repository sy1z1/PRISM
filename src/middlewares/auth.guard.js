import jwt from 'jsonwebtoken';
import { getAuthContextBySessionId } from '../modules/identity/identity.model.js';
import { evaluateSession, resolveSingleRole, toActor } from '../modules/authorization/policy.js';

const unauthorized = (res, error = 'Unauthorized: Invalid or expired token') =>
  res.status(401).json({ error });

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Unauthorized: No token provided');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return unauthorized(res, 'Unauthorized: No token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return unauthorized(res);
  }

  // Tokens issued before session binding have no sid and are rejected so they
  // cannot bypass revocation checks.
  if (!decoded || typeof decoded !== 'object' || !decoded.sid) {
    return unauthorized(res, 'Unauthorized: Session-bound token required');
  }

  try {
    const session = await getAuthContextBySessionId(decoded.sid);
    const evaluation = evaluateSession(session);
    if (!evaluation.ok) {
      return unauthorized(res, `Unauthorized: ${evaluation.reason}`);
    }

    if (String(session.user_id) !== String(decoded.userId)) {
      return unauthorized(res, 'Unauthorized: Session does not match token');
    }

    const roleResult = resolveSingleRole(session.roles);
    if (!roleResult.ok) {
      return res.status(403).json({ error: `Forbidden: ${roleResult.reason}` });
    }

    req.user = toActor(session);
    req.auth = { sessionId: session.session_id };
    return next();
  } catch (error) {
    console.error('Authentication context lookup failed:', error.message);
    return res.status(500).json({ error: 'Authentication unavailable' });
  }
};
