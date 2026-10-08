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

export const getUserByEmail = async (email) => {
  const query = `
    SELECT u.id, u.email, u.acc_status, c.password_hash, r.name as role_name
    FROM users u
    JOIN user_credentials c ON u.id = c.user_id
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.email = $1
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0]; 
};

export const createSession = async (userId, tokenHash, expiresAt) => {
  const query = `
    INSERT INTO user_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
  `;
  await pool.query(query, [userId, tokenHash, expiresAt]);
};

export const updateLastLogin = async (userId) => {
  const query = `
    UPDATE users 
    SET last_login_at = CURRENT_TIMESTAMP 
    WHERE id = $1
  `;
  await pool.query(query, [userId]);
};