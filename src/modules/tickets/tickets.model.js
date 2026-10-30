import { pool } from '../../config/db.js';
import { TICKET_STATUS, canTransition } from './ticket-transitions.js';

const assertTransition = (fromStatus, toStatus) => {
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error('INVALID_TRANSITION');
  }
};

const getAssetOrgForUpdate = async (client, assetId) => {
  const lock = await client.query(`SELECT id FROM assets WHERE id = $1 FOR UPDATE;`, [assetId]);
  if (!lock.rows[0]) return null;

  const query = `
    SELECT a.id, r.organization_id
    FROM assets a
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE a.id = $1;
  `;
  const { rows } = await client.query(query, [assetId]);
  return rows[0] || null;
};

const assertActiveGroupContract = async (client, organizationId, groupId) => {
  if (!organizationId) throw new Error('GROUP_NOT_CONTRACTED');
  const { rows } = await client.query(
    `SELECT id FROM organization_maintenance_groups
     WHERE organization_id = $1 AND group_id = $2 AND status = 'ACTIVE';`,
    [organizationId, groupId]
  );
  if (!rows[0]) throw new Error('GROUP_NOT_CONTRACTED');
};

const lockTicket = async (client, ticketId) => {
  const { rows } = await client.query(
    `SELECT * FROM tickets WHERE id = $1 FOR UPDATE;`,
    [ticketId]
  );
  if (!rows[0]) throw new Error('TICKET_NOT_FOUND');
  return rows[0];
};

const lockTicketMeta = async (client, ticketId) => {
  const lock = await client.query(`SELECT id FROM tickets WHERE id = $1 FOR UPDATE;`, [ticketId]);
  if (!lock.rows[0]) throw new Error('TICKET_NOT_FOUND');

  const query = `
    SELECT
      t.id, t.status, t.category, t.asset_id, t.maintenance_group_id,
      t.maintenance_group_id AS old_group_id,
      r.organization_id
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE t.id = $1;
  `;
  const { rows } = await client.query(query, [ticketId]);
  if (!rows[0]) throw new Error('TICKET_NOT_FOUND');
  return rows[0];
};

const insertAudit = async (client, ticketId, actorId, actionType, oldValue, newValue, notes = null) => {
  await client.query(
    `INSERT INTO ticket_audit_logs (ticket_id, actor_id, action_type, old_value, new_value, notes)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [ticketId, actorId, actionType, oldValue, newValue, notes]
  );
};

// 1. Create a ticket already assigned to the selected group (atomic).
export const createTicketTransaction = async ({
  assetId,
  groupId,
  reportedBy,
  category,
  priority = 'MEDIUM',
  description,
  mediaUrl = null,
  mediaType = 'field_photo'
}) => {
  if (!groupId) throw new Error('GROUP_REQUIRED');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const asset = await getAssetOrgForUpdate(client, assetId);
    if (!asset) throw new Error('ASSET_NOT_FOUND');

    await assertActiveGroupContract(client, asset.organization_id, groupId);

    const { rows: ticketRows } = await client.query(
      `INSERT INTO tickets
         (asset_id, reported_by, category, priority, description, status, maintenance_group_id)
       VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', $6)
       RETURNING *;`,
      [assetId, reportedBy, category, priority.toUpperCase(), description, groupId]
    );
    const ticket = ticketRows[0];

    await client.query(
      `INSERT INTO ticket_assignments (ticket_id, group_id, assignee_id, assigned_by, status)
       VALUES ($1, $2, NULL, $3, 'DISPATCHED');`,
      [ticket.id, groupId, reportedBy]
    );

    await insertAudit(client, ticket.id, reportedBy, 'TICKET_CREATED', null, TICKET_STATUS.ASSIGNED);
    await insertAudit(
      client,
      ticket.id,
      reportedBy,
      'ASSIGNED_TO_GROUP',
      null,
      String(groupId)
    );

    let media = null;
    if (mediaUrl) {
      const { rows: mediaRows } = await client.query(
        `INSERT INTO ticket_media (ticket_id, media_url, media_type, evidence_stage, uploaded_by)
         VALUES ($1, $2, $3, 'BEFORE', $4)
         RETURNING *;`,
        [ticket.id, mediaUrl, mediaType, reportedBy]
      );
      media = mediaRows[0];
    }

    await client.query('COMMIT');
    return { ticket, media };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 2. Full ticket detail.
export const getTicketById = async (ticketId) => {
  const ticketQuery = `
    SELECT
      t.*,
      a.name_identifier AS asset_name,
      s.name AS site_name,
      s.site_code,
      r.organization_id,
      o.name AS organization_name,
      mg.name AS maintenance_group_name,
      mg.group_code AS maintenance_group_code,
      ru.email AS reported_by_email,
      au.email AS acknowledged_by_email,
      cu.email AS completed_by_email,
      vu.email AS verified_by_email
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    LEFT JOIN organizations o ON o.id = r.organization_id
    LEFT JOIN maintenance_groups mg ON t.maintenance_group_id = mg.id
    LEFT JOIN users ru ON ru.id = t.reported_by
    LEFT JOIN users au ON au.id = t.acknowledged_by
    LEFT JOIN users cu ON cu.id = t.completed_by
    LEFT JOIN users vu ON vu.id = t.verified_by
    WHERE t.id = $1;
  `;
  const { rows: ticketRows } = await pool.query(ticketQuery, [ticketId]);
  if (!ticketRows[0]) return null;

  const mediaQuery = `
    SELECT * FROM ticket_media
    WHERE ticket_id = $1
    ORDER BY created_at ASC;
  `;

  const assignQuery = `
    SELECT
      ta.id, ta.ticket_id, ta.assigned_by, ta.status,
      ta.assigned_at, ta.started_at, ta.completed_at, ta.group_id,
      mg.name AS group_name, mg.group_code, mg.contact_phone AS group_phone,
      u.email AS assigned_by_email
    FROM ticket_assignments ta
    LEFT JOIN maintenance_groups mg ON ta.group_id = mg.id
    LEFT JOIN users u ON u.id = ta.assigned_by
    WHERE ta.ticket_id = $1
    ORDER BY ta.assigned_at DESC;
  `;

  const auditQuery = `
    SELECT a.*, u.email AS actor_email
    FROM ticket_audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.ticket_id = $1
    ORDER BY a.logged_at ASC;
  `;

  const [mediaRes, assignRes, auditRes] = await Promise.all([
    pool.query(mediaQuery, [ticketId]),
    pool.query(assignQuery, [ticketId]),
    pool.query(auditQuery, [ticketId])
  ]);

  return {
    ...ticketRows[0],
    media: mediaRes.rows,
    assignments: assignRes.rows,
    auditLogs: auditRes.rows
  };
};

// 3. Tickets for an asset, optionally restricted to supervised groups.
export const getTicketsByAssetId = async (assetId, groupIds = null, organizationId = null) => {
  const params = [assetId];
  let restriction = '';
  if (Array.isArray(groupIds)) {
    params.push(groupIds);
    restriction = `AND t.maintenance_group_id = ANY($${params.length}::uuid[])`;
    if (organizationId) {
      params.push(organizationId);
      restriction += ` AND EXISTS (
        SELECT 1 FROM organization_maintenance_groups omg
        WHERE omg.group_id = t.maintenance_group_id
          AND omg.organization_id = $${params.length}
          AND omg.status = 'ACTIVE'
      )`;
    }
  }
  const query = `
    SELECT t.*, mg.name AS maintenance_group_name, mg.group_code AS maintenance_group_code
    FROM tickets t
    LEFT JOIN maintenance_groups mg ON t.maintenance_group_id = mg.id
    WHERE t.asset_id = $1
    ${restriction}
    ORDER BY t.created_at DESC;
  `;
  const { rows } = await pool.query(query, params);
  return rows;
};

// 4. Contracted groups for an existing ticket (management dispatch options).
export const getCandidateGroupsForTicket = async (ticketId) => {
  const { rows: metaRows } = await pool.query(
    `SELECT t.id AS ticket_id, t.category, t.status, r.organization_id
     FROM tickets t
     JOIN assets a ON t.asset_id = a.id
     LEFT JOIN sites s ON a.site_id = s.id
     LEFT JOIN regions r ON s.region_id = r.id
     WHERE t.id = $1;`,
    [ticketId]
  );
  if (!metaRows[0]) return null;

  const { category, organization_id: organizationId } = metaRows[0];

  if (!organizationId) {
    return { ticketId, category, organizationId: null, recommendedGroup: null, availableGroups: [] };
  }

  const { rows: groups } = await pool.query(
    `SELECT
        mg.id AS group_id, mg.name AS group_name, mg.group_type,
        mg.specialty_category, mg.group_code, mg.contact_email, mg.contact_phone,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('APPROVED','CANCELLED'))::int AS open_tickets_count,
        CASE
          WHEN LOWER(mg.specialty_category) = LOWER($2) THEN 1
          WHEN mg.specialty_category IS NULL THEN 2
          ELSE 3
        END AS specialty_rank
     FROM organization_maintenance_groups omg
     JOIN maintenance_groups mg ON omg.group_id = mg.id
     LEFT JOIN tickets t ON t.maintenance_group_id = mg.id
     WHERE omg.organization_id = $1 AND omg.status = 'ACTIVE'
     GROUP BY mg.id
     ORDER BY specialty_rank ASC, open_tickets_count ASC;`,
    [organizationId, category]
  );

  return {
    ticketId,
    category,
    organizationId,
    recommendedGroup: groups[0] || null,
    availableGroups: groups
  };
};

// 5. Reassign the responsible group (management). Prior assignment rows are
// never modified; a new row is appended.
export const assignTicketTransaction = async ({ ticketId, groupId, assignedBy }) => {
  if (!groupId) throw new Error('GROUP_REQUIRED');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const meta = await lockTicketMeta(client, ticketId);
    assertTransition(meta.status, TICKET_STATUS.ASSIGNED);
    await assertActiveGroupContract(client, meta.organization_id, groupId);

    const { rows: updatedRows } = await client.query(
      `UPDATE tickets
       SET status = 'ASSIGNED',
           maintenance_group_id = $1,
           acknowledged_at = NULL,
           acknowledged_by = NULL,
           completed_at = NULL,
           completed_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *;`,
      [groupId, ticketId]
    );

    await client.query(
      `INSERT INTO ticket_assignments (ticket_id, group_id, assignee_id, assigned_by, status)
       VALUES ($1, $2, NULL, $3, 'DISPATCHED');`,
      [ticketId, groupId, assignedBy]
    );

    await insertAudit(
      client,
      ticketId,
      assignedBy,
      'GROUP_REASSIGNED',
      meta.old_group_id ? String(meta.old_group_id) : null,
      String(groupId)
    );

    await client.query('COMMIT');
    return { dispatchMode: 'GROUP_REASSIGNED', ticket: updatedRows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 6. Supervisor acknowledgement (ASSIGNED -> ACKNOWLEDGED).
export const acknowledgeTicketTransaction = async ({ ticketId, supervisorId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await lockTicket(client, ticketId);
    assertTransition(ticket.status, TICKET_STATUS.ACKNOWLEDGED);

    const { rows } = await client.query(
      `UPDATE tickets
       SET status = 'ACKNOWLEDGED',
           acknowledged_at = CURRENT_TIMESTAMP,
           acknowledged_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *;`,
      [supervisorId, ticketId]
    );

    await insertAudit(client, ticketId, supervisorId, 'ACKNOWLEDGED', ticket.status, TICKET_STATUS.ACKNOWLEDGED);

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 7. Supervisor starts work (ACKNOWLEDGED -> IN_PROGRESS).
export const startWorkTransaction = async ({ ticketId, supervisorId, note = null }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await lockTicket(client, ticketId);
    assertTransition(ticket.status, TICKET_STATUS.IN_PROGRESS);

    await client.query(
      `UPDATE ticket_assignments
       SET status = 'ACCEPTED', started_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND status = 'DISPATCHED';`,
      [ticketId]
    );

    const { rows } = await client.query(
      `UPDATE tickets SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *;`,
      [ticketId]
    );

    await insertAudit(
      client,
      ticketId,
      supervisorId,
      'STATUS_CHANGED',
      ticket.status,
      TICKET_STATUS.IN_PROGRESS,
      note
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 8. Supervisor reports completion (IN_PROGRESS -> PENDING_VERIFICATION).
// Legacy IN_PROGRESS tickets may complete without an acknowledgement record.
export const completeTicketTransaction = async ({
  ticketId,
  supervisorId,
  resolutionNotes,
  afterMediaUrl = null
}) => {
  if (!resolutionNotes || !String(resolutionNotes).trim()) {
    throw new Error('RESOLUTION_NOTES_REQUIRED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await lockTicket(client, ticketId);
    assertTransition(ticket.status, TICKET_STATUS.PENDING_VERIFICATION);

    await client.query(
      `UPDATE ticket_assignments
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND status IN ('DISPATCHED', 'ACCEPTED');`,
      [ticketId]
    );

    const { rows } = await client.query(
      `UPDATE tickets
       SET status = 'PENDING_VERIFICATION',
           resolution_notes = $1,
           completed_at = CURRENT_TIMESTAMP,
           completed_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *;`,
      [resolutionNotes, supervisorId, ticketId]
    );

    let media = null;
    if (afterMediaUrl) {
      const { rows: mediaRows } = await client.query(
        `INSERT INTO ticket_media (ticket_id, media_url, media_type, evidence_stage, uploaded_by)
         VALUES ($1, $2, 'field_photo', 'AFTER', $3)
         RETURNING *;`,
        [ticketId, afterMediaUrl, supervisorId]
      );
      media = mediaRows[0];
    }

    await insertAudit(
      client,
      ticketId,
      supervisorId,
      'SUBMITTED_FOR_VERIFICATION',
      ticket.status,
      TICKET_STATUS.PENDING_VERIFICATION
    );

    await client.query('COMMIT');
    return { ticket: rows[0], afterMedia: media };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 9. Independent verification. Rejection returns to IN_PROGRESS and never
// mutates assignment history. Completion actor/timestamp history is retained.
export const verifyTicketTransaction = async ({ ticketId, verifierId, approved, rejectionReason = null }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await lockTicket(client, ticketId);
    assertTransition(ticket.status, approved ? TICKET_STATUS.APPROVED : TICKET_STATUS.IN_PROGRESS);

    if (!approved && (!rejectionReason || !String(rejectionReason).trim())) {
      throw new Error('REJECTION_REASON_REQUIRED');
    }

    const newStatus = approved ? TICKET_STATUS.APPROVED : TICKET_STATUS.IN_PROGRESS;

    const { rows } = await client.query(
      approved
        ? `UPDATE tickets
           SET status = 'APPROVED', verified_by = $1, verified_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 RETURNING *;`
        : `UPDATE tickets
           SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *;`,
      approved ? [verifierId, ticketId] : [ticketId]
    );

    await insertAudit(
      client,
      ticketId,
      verifierId,
      approved ? 'MANAGEMENT_APPROVED' : 'MANAGEMENT_REJECTED',
      ticket.status,
      newStatus,
      approved ? null : rejectionReason
    );

    if (approved) {
      await client.query(
        `INSERT INTO asset_maintenance_logs (asset_id, ticket_id, maintenance_type, performed_by, notes)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          ticket.asset_id,
          ticket.id,
          ticket.category,
          verifierId,
          ticket.resolution_notes || null
        ]
      );
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 10. Management cancellation.
export const cancelTicketTransaction = async ({ ticketId, cancelledBy, reason }) => {
  if (!reason || !String(reason).trim()) throw new Error('CANCELLATION_REASON_REQUIRED');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await lockTicket(client, ticketId);
    assertTransition(ticket.status, TICKET_STATUS.CANCELLED);

    const { rows } = await client.query(
      `UPDATE tickets SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *;`,
      [ticketId]
    );

    await insertAudit(
      client,
      ticketId,
      cancelledBy,
      'TICKET_CANCELLED',
      ticket.status,
      TICKET_STATUS.CANCELLED,
      reason
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 11. Management reopen (APPROVED/CANCELLED -> ASSIGNED) with required group.
export const reopenTicketTransaction = async ({ ticketId, reopenedBy, groupId, reason }) => {
  if (!groupId) throw new Error('GROUP_REQUIRED');
  if (!reason || !String(reason).trim()) throw new Error('REOPEN_REASON_REQUIRED');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const meta = await lockTicketMeta(client, ticketId);
    assertTransition(meta.status, TICKET_STATUS.ASSIGNED);
    await assertActiveGroupContract(client, meta.organization_id, groupId);

    const { rows } = await client.query(
      `UPDATE tickets
       SET status = 'ASSIGNED',
           maintenance_group_id = $1,
           acknowledged_at = NULL,
           acknowledged_by = NULL,
           completed_at = NULL,
           completed_by = NULL,
           verified_by = NULL,
           verified_at = NULL,
           reopen_count = reopen_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *;`,
      [groupId, ticketId]
    );

    await client.query(
      `INSERT INTO ticket_assignments (ticket_id, group_id, assignee_id, assigned_by, status)
       VALUES ($1, $2, NULL, $3, 'DISPATCHED');`,
      [ticketId, groupId, reopenedBy]
    );

    await insertAudit(
      client,
      ticketId,
      reopenedBy,
      'TICKET_REOPENED',
      meta.status,
      TICKET_STATUS.ASSIGNED,
      reason
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 12. Ticket queue. Supervisor: scoped to supervised groups. Management:
// scoped to the caller's organization (SuperAdmin: all organizations).
export const listTicketQueue = async ({
  groupIds = null,
  organizationId = undefined,
  requireActiveGroupLink = false,
  status = null,
  siteId = null,
  priority = null,
  search = null,
  page = 1,
  limit = 20
}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const params = [];
  const conditions = [];

  if (Array.isArray(groupIds) && groupIds.length > 0) {
    params.push(groupIds);
    conditions.push(`t.maintenance_group_id = ANY($${params.length}::uuid[])`);
  }
  if (requireActiveGroupLink) {
    conditions.push(`EXISTS (
      SELECT 1 FROM organization_maintenance_groups omg
      WHERE omg.group_id = t.maintenance_group_id
        AND omg.organization_id = r.organization_id
        AND omg.status = 'ACTIVE'
    )`);
  }
  if (organizationId !== undefined && organizationId !== null) {
    params.push(organizationId);
    conditions.push(`r.organization_id = $${params.length}`);
  }
  if (status) {
    params.push(String(status));
    conditions.push(`t.status = $${params.length}`);
  }
  if (siteId) {
    params.push(String(siteId));
    conditions.push(`a.site_id = $${params.length}`);
  }
  if (priority) {
    params.push(String(priority).toUpperCase());
    conditions.push(`t.priority = $${params.length}`);
  }
  if (search) {
    params.push(`%${String(search)}%`);
    conditions.push(
      `(t.ticket_number ILIKE $${params.length} OR a.name_identifier ILIKE $${params.length} OR t.description ILIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joins = `
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    LEFT JOIN organizations o ON o.id = r.organization_id
    LEFT JOIN maintenance_groups mg ON t.maintenance_group_id = mg.id
  `;

  const countQuery = `SELECT count(*)::int AS total ${joins} ${where};`;
  const { rows: countRows } = await pool.query(countQuery, params);
  const total = countRows[0]?.total || 0;

  const listParams = [...params, safeLimit, offset];
  const listQuery = `
    SELECT
      t.id, t.ticket_number, t.asset_id, t.category, t.priority, t.status,
      t.description, t.created_at, t.updated_at, t.maintenance_group_id,
      t.acknowledged_at, t.completed_at,
      a.name_identifier AS asset_name,
      s.name AS site_name, s.site_code,
      r.organization_id, o.name AS organization_name,
      mg.name AS maintenance_group_name, mg.group_code AS maintenance_group_code
    ${joins}
    ${where}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length};
  `;
  const { rows } = await pool.query(listQuery, listParams);

  return {
    tickets: rows,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit)
  };
};
