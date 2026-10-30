import { pool } from '../../config/db.js';

// All lookups resolve the owning organization through the canonical chain:
// asset -> site -> region -> organization. Missing links produce a NULL
// organization, which is denied for non-SuperAdmin actors.

export const getAssetOrg = async (assetId) => {
  const query = `
    SELECT a.id, r.organization_id
    FROM assets a
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE a.id = $1;
  `;
  const { rows } = await pool.query(query, [assetId]);
  return rows[0] || null;
};

export const getSiteOrg = async (siteId) => {
  const query = `
    SELECT s.id, r.organization_id
    FROM sites s
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE s.id = $1;
  `;
  const { rows } = await pool.query(query, [siteId]);
  return rows[0] || null;
};

export const getTicketMeta = async (ticketId) => {
  const query = `
    SELECT
      t.id,
      t.status,
      t.reported_by,
      t.maintenance_group_id,
      t.acknowledged_by,
      t.completed_by,
      t.verified_by,
      r.organization_id
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE t.id = $1;
  `;
  const { rows } = await pool.query(query, [ticketId]);
  return rows[0] || null;
};

export const getCaptureOrg = async (captureId) => {
  const query = `
    SELECT c.id, a.id AS asset_id, r.organization_id
    FROM asset_captures c
    JOIN assets a ON c.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE c.id = $1;
  `;
  const { rows } = await pool.query(query, [captureId]);
  return rows[0] || null;
};

export const getHotspotOrg = async (hotspotId) => {
  const query = `
    SELECT h.id, r.organization_id
    FROM capture_hotspots h
    JOIN asset_captures c ON h.source_capture_id = c.id
    JOIN assets a ON c.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE h.id = $1;
  `;
  const { rows } = await pool.query(query, [hotspotId]);
  return rows[0] || null;
};

export const getActiveAssigneeIds = async (ticketId) => {
  const query = `
    SELECT DISTINCT assignee_id
    FROM ticket_assignments
    WHERE ticket_id = $1
      AND assignee_id IS NOT NULL
      AND status IN ('DISPATCHED', 'ACCEPTED');
  `;
  const { rows } = await pool.query(query, [ticketId]);
  return rows.map((row) => row.assignee_id);
};

// Every user who was ever assigned responsibility for the ticket. Used to
// prevent self-verification, including after an assignment is completed.
export const getAssigneeIds = async (ticketId) => {
  const query = `
    SELECT DISTINCT assignee_id
    FROM ticket_assignments
    WHERE ticket_id = $1
      AND assignee_id IS NOT NULL;
  `;
  const { rows } = await pool.query(query, [ticketId]);
  return rows.map((row) => row.assignee_id);
};

// Prior approvers, from the audit trail. Kept separate from the mutable
// tickets.verified_by column so reopen cannot erase the independence guard.
export const getPriorVerifierIds = async (ticketId) => {
  const query = `
    SELECT DISTINCT actor_id
    FROM ticket_audit_logs
    WHERE ticket_id = $1
      AND action_type = 'MANAGEMENT_APPROVED'
      AND actor_id IS NOT NULL;
  `;
  const { rows } = await pool.query(query, [ticketId]);
  return rows.map((row) => row.actor_id);
};

export const isAssignedToTicket = async (ticketId, userId) => {
  const query = `
    SELECT 1
    FROM ticket_assignments
    WHERE ticket_id = $1
      AND assignee_id = $2
      AND status IN ('DISPATCHED', 'ACCEPTED')
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [ticketId, userId]);
  return rows.length > 0;
};

// Supervisor authority is derived from active rows in
// maintenance_group_supervisors; no role is required.
export const isActiveSupervisorOfGroup = async (userId, groupId) => {
  if (!userId || !groupId) return false;
  const query = `
    SELECT 1
    FROM maintenance_group_supervisors
    WHERE user_id = $1
      AND group_id = $2
      AND revoked_at IS NULL
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [userId, groupId]);
  return rows.length > 0;
};

export const getSupervisorGroupIds = async (userId) => {
  if (!userId) return [];
  const query = `
    SELECT DISTINCT group_id
    FROM maintenance_group_supervisors
    WHERE user_id = $1
      AND revoked_at IS NULL;
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows.map((row) => row.group_id);
};

// Uploaded-file lookups. URLs are stored as /uploads/... strings.

export const getTicketMediaOrgByUrl = async (mediaUrl) => {
  const query = `
    SELECT tm.id, tm.ticket_id, t.maintenance_group_id, r.organization_id
    FROM ticket_media tm
    JOIN tickets t ON tm.ticket_id = t.id
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE tm.media_url = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [mediaUrl]);
  return rows[0] || null;
};

export const getCaptureOrgByUrl = async (imageUrl) => {
  const query = `
    SELECT c.id, r.organization_id
    FROM asset_captures c
    JOIN assets a ON c.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE c.image_360_url = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [imageUrl]);
  return rows[0] || null;
};

export const getAssetOrgByImageUrl = async (imageUrl) => {
  const query = `
    SELECT a.id, r.organization_id
    FROM assets a
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE a.image_url = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [imageUrl]);
  return rows[0] || null;
};
