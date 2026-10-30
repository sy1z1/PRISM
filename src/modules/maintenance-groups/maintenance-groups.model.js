import { pool } from '../../config/db.js';

export const getAvailableGroupsForAsset = async (assetId) => {
  const { rows: assetRows } = await pool.query(
    `SELECT a.id, r.organization_id
     FROM assets a
     LEFT JOIN sites s ON a.site_id = s.id
     LEFT JOIN regions r ON s.region_id = r.id
     WHERE a.id = $1;`,
    [assetId]
  );
  if (!assetRows[0]) throw new Error('ASSET_NOT_FOUND');
  const organizationId = assetRows[0].organization_id;
  if (!organizationId) return [];

  const { rows } = await pool.query(
    `SELECT mg.id, mg.name, mg.group_code, mg.specialty_category, mg.group_type
     FROM organization_maintenance_groups omg
     JOIN maintenance_groups mg ON omg.group_id = mg.id
     WHERE omg.organization_id = $1 AND omg.status = 'ACTIVE'
     ORDER BY mg.name ASC;`,
    [organizationId]
  );
  return rows;
};

export const getGroupSupervisors = async (groupId) => {
  const { rows } = await pool.query(
    `SELECT
       s.user_id, s.granted_at, s.granted_by,
       u.email, u.acc_status
     FROM maintenance_group_supervisors s
     JOIN users u ON s.user_id = u.id
     WHERE s.group_id = $1 AND s.revoked_at IS NULL
     ORDER BY s.granted_at ASC;`,
    [groupId]
  );
  return rows;
};

export const grantGroupSupervisor = async ({ groupId, userId, grantedBy }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: groupRows } = await client.query(
      `SELECT id FROM maintenance_groups WHERE id = $1;`,
      [groupId]
    );
    if (!groupRows[0]) throw new Error('GROUP_NOT_FOUND');

    const { rows: userRows } = await client.query(
      `SELECT id FROM users
       WHERE id = $1 AND COALESCE(LOWER(acc_status), 'active') = 'active';`,
      [userId]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');

    const { rows: existing } = await client.query(
      `SELECT id FROM maintenance_group_supervisors
       WHERE group_id = $1 AND user_id = $2 AND revoked_at IS NULL;`,
      [groupId, userId]
    );
    if (existing[0]) {
      await client.query('COMMIT');
      return { id: existing[0].id, alreadyGranted: true };
    }

    const { rows } = await client.query(
      `INSERT INTO maintenance_group_supervisors (group_id, user_id, granted_by)
       VALUES ($1, $2, $3)
       RETURNING id, group_id, user_id, granted_by, granted_at;`,
      [groupId, userId, grantedBy]
    );

    await client.query('COMMIT');
    return { ...rows[0], alreadyGranted: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const revokeGroupSupervisor = async ({ groupId, userId, revokedBy }) => {
  const { rows } = await pool.query(
    `UPDATE maintenance_group_supervisors
     SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $3
     WHERE group_id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id, group_id, user_id, revoked_at;`,
    [groupId, userId, revokedBy]
  );
  return rows[0] || null;
};

// D7: management links a contractor group by its unique group_code and toggles
// the link status for its own organization.
export const getLinkedGroups = async (organizationId) => {
  const { rows } = await pool.query(
    `SELECT
       omg.id AS link_id,
       omg.status,
       mg.id AS group_id,
       mg.name,
       mg.group_code,
       mg.group_type,
       mg.specialty_category,
       mg.contact_email,
       mg.contact_phone
     FROM organization_maintenance_groups omg
     JOIN maintenance_groups mg ON mg.id = omg.group_id
     WHERE omg.organization_id = $1
     ORDER BY mg.name ASC;`,
    [organizationId]
  );
  return rows;
};

export const linkGroupByCode = async ({ organizationId, groupCode, status }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: groupRows } = await client.query(
      `SELECT id, name, group_code, group_type, specialty_category
       FROM maintenance_groups
       WHERE LOWER(group_code) = LOWER($1);`,
      [groupCode]
    );
    if (!groupRows[0]) throw new Error('GROUP_NOT_FOUND');

    const { rows } = await client.query(
      `INSERT INTO organization_maintenance_groups (organization_id, group_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, group_id)
       DO UPDATE SET status = EXCLUDED.status
       RETURNING *;`,
      [organizationId, groupRows[0].id, status]
    );

    await client.query('COMMIT');
    return { ...rows[0], group: groupRows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateGroupLinkStatus = async ({ organizationId, groupId, status }) => {
  const { rows } = await pool.query(
    `UPDATE organization_maintenance_groups
     SET status = $3
     WHERE organization_id = $1 AND group_id = $2
     RETURNING *;`,
    [organizationId, groupId, status]
  );
  return rows[0] || null;
};
