import { pool } from '../../config/db.js';

const ORG_REQUIRED_ROLES = new Set(['Council Admin', 'Data Entry']);
const ACCOUNT_STATUSES = new Set(['Active', 'Disabled', 'Suspended']);

const validateRoleAndOrg = async (client, { role, organizationId }) => {
  if (!role) throw new Error('ROLE_REQUIRED');

  const roleResult = await client.query('SELECT id, name FROM roles WHERE name = $1;', [role]);
  if (!roleResult.rows[0]) throw new Error('ROLE_INVALID');
  const roleRow = roleResult.rows[0];

  if (roleRow.name === 'SuperAdmin') {
    if (organizationId) throw new Error('ORGANIZATION_NOT_ALLOWED');
    return roleRow;
  }

  if (organizationId) {
    const orgResult = await client.query('SELECT id FROM organizations WHERE id = $1;', [organizationId]);
    if (!orgResult.rows[0]) throw new Error('ORGANIZATION_NOT_FOUND');
    return roleRow;
  }

  if (ORG_REQUIRED_ROLES.has(roleRow.name)) {
    throw new Error('ORGANIZATION_REQUIRED');
  }

  return roleRow;
};

const selectUserById = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT
       u.id, u.email, u.acc_status, u.organization_id,
       o.name AS organization_name,
       u.created_at, u.last_login_at,
       COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::varchar[]) AS roles
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id, o.name;`,
    [userId]
  );
  return rows[0] || null;
};

export const provisionNewUser = async ({ email, passwordHash, role, organizationId = null }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const roleRow = await validateRoleAndOrg(client, { role, organizationId });

    const { rows } = await client.query(
      `INSERT INTO users (email, acc_status, organization_id)
       VALUES ($1, 'Active', $2)
       RETURNING id, email, acc_status, organization_id, created_at;`,
      [email, organizationId]
    );
    const newUser = rows[0];

    await client.query(
      `INSERT INTO user_credentials (user_id, provider, password_hash)
       VALUES ($1, 'local', $2);`,
      [newUser.id, passwordHash]
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`,
      [newUser.id, roleRow.id]
    );

    await client.query('COMMIT');
    return { ...newUser, role: roleRow.name };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listUsers = async () => {
  const { rows } = await pool.query(
    `SELECT
       u.id, u.email, u.acc_status, u.organization_id,
       o.name AS organization_name,
       u.created_at, u.last_login_at,
       COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::varchar[]) AS roles
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY u.id, o.name
     ORDER BY u.created_at ASC;`
  );
  return rows;
};

export const listOrganizations = async () => {
  const { rows } = await pool.query('SELECT id, name FROM organizations ORDER BY name ASC;');
  return rows;
};

export const updateUser = async ({ userId, role, organizationId, accStatus }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE;', [userId]);
    if (!existing.rows[0]) throw new Error('USER_NOT_FOUND');

    if (accStatus !== undefined) {
      if (!ACCOUNT_STATUSES.has(accStatus)) throw new Error('INVALID_ACCOUNT_STATUS');
      await client.query(
        `UPDATE users SET acc_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [accStatus, userId]
      );
      if (accStatus !== 'Active') {
        await client.query(
          `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND revoked_at IS NULL;`,
          [userId]
        );
      }
    }

    if (role !== undefined || organizationId !== undefined) {
      const current = await client.query(
        `SELECT u.organization_id,
                COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::varchar[]) AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id, u.organization_id;`,
        [userId]
      );
      const currentRole = role !== undefined ? role : current.rows[0]?.roles?.[0] ?? null;
      const currentOrg = organizationId !== undefined ? organizationId : current.rows[0]?.organization_id ?? null;

      const roleRow = await validateRoleAndOrg(client, { role: currentRole, organizationId: currentOrg });

      await client.query(
        `UPDATE users SET organization_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [currentOrg, userId]
      );
      await client.query('DELETE FROM user_roles WHERE user_id = $1;', [userId]);
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);', [
        userId,
        roleRow.id
      ]);

      // Role/organization change invalidates existing sessions.
      await client.query(
        `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND revoked_at IS NULL;`,
        [userId]
      );
    }

    const updated = await selectUserById(client, userId);
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const resetUserPassword = async (userId, passwordHash) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE;', [userId]);
    if (!user.rows[0]) throw new Error('USER_NOT_FOUND');

    const credential = await client.query(
      `UPDATE user_credentials
       SET password_hash = $1, cred_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING id;`,
      [passwordHash, userId]
    );

    if (!credential.rows[0]) {
      await client.query(
        `INSERT INTO user_credentials (user_id, provider, password_hash)
         VALUES ($1, 'local', $2);`,
        [userId, passwordHash]
      );
    }

    await client.query(
      `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

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

export const revokeAllSessions = async (userId) => {
  const { rowCount } = await pool.query(
    `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND revoked_at IS NULL;`,
    [userId]
  );
  return rowCount;
};

export const purgeExpiredSessions = async (retentionDays = 30) => {
  const { rowCount } = await pool.query(
    `DELETE FROM user_sessions
     WHERE expires_at < (CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day'));`,
    [retentionDays]
  );
  return rowCount;
};
