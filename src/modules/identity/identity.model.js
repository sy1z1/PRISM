import { pool } from '../../config/db.js';

export const provisionNewUser = async (email, passwordHash) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertUserQuery = `
      INSERT INTO users (email, acc_status) 
      VALUES ($1, 'Active') 
      RETURNING id, email, acc_status, created_at
    `;
    const userResult = await client.query(insertUserQuery, [email]);
    const newUser = userResult.rows[0];

    const insertCredQuery = `
      INSERT INTO user_credentials (user_id, provider, password_hash)
      VALUES ($1, 'local', $2)
    `;
    await client.query(insertCredQuery, [newUser.id, passwordHash]);

    await client.query('COMMIT');

    return newUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Returns the credential row plus every assigned role so the service can
// reject ambiguous (multi-role) accounts instead of picking one arbitrarily.
export const getUserByEmail = async (email) => {
  const query = `
    SELECT
      u.id,
      u.email,
      u.acc_status,
      u.organization_id,
      c.password_hash,
      COALESCE(
        array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS roles
    FROM users u
    JOIN user_credentials c ON u.id = c.user_id
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.email = $1
    GROUP BY u.id, u.email, u.acc_status, u.organization_id, c.password_hash;
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0];
};

export const createSession = async ({ sessionId, userId, tokenHash, expiresAt }) => {
  const query = `
    INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;
  const { rows } = await pool.query(query, [sessionId, userId, tokenHash, expiresAt]);
  return rows[0];
};

// Trusted server-side auth context for a session id. Used on every request so
// roles, organization, and account status never rely on JWT claims.
export const getAuthContextBySessionId = async (sessionId) => {
  const query = `
    SELECT
      s.id AS session_id,
      s.user_id,
      s.revoked_at,
      s.expires_at,
      u.email,
      u.acc_status,
      u.organization_id,
      COALESCE(
        array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS roles
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE s.id = $1
    GROUP BY s.id, s.user_id, s.revoked_at, s.expires_at, u.email, u.acc_status, u.organization_id;
  `;
  const { rows } = await pool.query(query, [sessionId]);
  return rows[0] || null;
};

export const updateLastLogin = async (userId) => {
  const query = `
    UPDATE users 
    SET last_login_at = CURRENT_TIMESTAMP 
    WHERE id = $1
  `;
  await pool.query(query, [userId]);
};

// Revokes only the caller's own active session. The user id is required so a
// leaked/guessed session id cannot revoke another user's session.
export const revokeSession = async (sessionId, userId) => {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND user_id = $2
      AND revoked_at IS NULL
    RETURNING id, revoked_at;
  `;
  const { rows } = await pool.query(query, [sessionId, userId]);
  return rows[0] || null;
};
