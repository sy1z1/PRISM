import { pool } from '../../config/db.js';

// 1. Create a New Ticket (+ Audit Log + Optional 'BEFORE' Media)
export const createTicketTransaction = async ({
  assetId,
  reportedBy,
  category,
  priority = 'MEDIUM',
  description,
  mediaUrl = null,
  mediaType = 'field_photo'
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertTicketQuery = `
      INSERT INTO tickets (asset_id, reported_by, category, priority, description, status)
      VALUES ($1, $2, $3, $4, $5, 'OPEN')
      RETURNING *;
    `;
    const { rows: ticketRows } = await client.query(insertTicketQuery, [
      assetId,
      reportedBy,
      category,
      priority.toUpperCase(),
      description
    ]);
    const ticket = ticketRows[0];

    // Record Audit Log
    await client.query(
      `INSERT INTO ticket_audit_logs (ticket_id, actor_id, action_type, old_value, new_value)
       VALUES ($1, $2, 'TICKET_CREATED', NULL, 'OPEN');`,
      [ticket.id, reportedBy]
    );

    // Optional: Attach 'BEFORE' photo if uploaded with the report
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

// 2. Get Full Ticket Details (Ticket + Media + Group/Worker Assignments + Audit Trail)
export const getTicketById = async (ticketId) => {
  const ticketQuery = `
    SELECT 
      t.*,
      a.name_identifier AS asset_name,
      s.name AS site_name,
      s.site_code,
      r.organization_id
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    JOIN sites s ON a.site_id = s.id
    JOIN regions r ON s.region_id = r.id
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
      ta.*,
      mg.name AS group_name,
      mg.group_code,
      mg.contact_phone AS group_phone,
      u.full_name AS assignee_name,
      u.email AS assignee_email,
      u.phone_number AS assignee_phone
    FROM ticket_assignments ta
    LEFT JOIN maintenance_groups mg ON ta.group_id = mg.id
    LEFT JOIN users u ON ta.assignee_id = u.id
    WHERE ta.ticket_id = $1
    ORDER BY ta.assigned_at DESC;
  `;

  const auditQuery = `
    SELECT * FROM ticket_audit_logs 
    WHERE ticket_id = $1 
    ORDER BY logged_at ASC;
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

// 3. Get All Tickets for a Specific Asset
export const getTicketsByAssetId = async (assetId) => {
  const query = `
    SELECT * FROM tickets
    WHERE asset_id = $1
    ORDER BY created_at DESC;
  `;
  const { rows } = await pool.query(query, [assetId]);
  return rows;
};

// 4. Calculate Active Contracted Maintenance Groups & Workload for a Ticket
export const getCandidateGroupsForTicket = async (ticketId) => {
  // Resolve the ticket's category and owning organization_id via asset -> site -> region
  const metaQuery = `
    SELECT 
      t.id AS ticket_id,
      t.category,
      t.status,
      r.organization_id
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    JOIN sites s ON a.site_id = s.id
    JOIN regions r ON s.region_id = r.id
    WHERE t.id = $1;
  `;
  const { rows: metaRows } = await pool.query(metaQuery, [ticketId]);
  if (!metaRows[0]) return null;

  const { category, organization_id: organizationId } = metaRows[0];

  // Fetch all 'ACTIVE' linked groups for this Organization, ranked by:
  // 1) Specialty match (exact category match or general NULL specialty)
  // 2) Lowest utilisation ratio (active tickets / total workers in group)
  // 3) Lowest raw active ticket count
  const groupsQuery = `
    SELECT 
      mg.id AS group_id,
      mg.name AS group_name,
      mg.group_type,
      mg.specialty_category,
      mg.group_code,
      mg.contact_email,
      mg.contact_phone,
      COUNT(DISTINCT mgm.user_id)::int AS member_count,
      COUNT(DISTINCT ta.id) FILTER (WHERE ta.status IN ('DISPATCHED', 'ACCEPTED'))::int AS active_tickets_count,
      CASE 
        WHEN COUNT(DISTINCT mgm.user_id) = 0 THEN 999999.0
        ELSE ROUND(
          COUNT(DISTINCT ta.id) FILTER (WHERE ta.status IN ('DISPATCHED', 'ACCEPTED'))::numeric 
          / COUNT(DISTINCT mgm.user_id)::numeric, 
          2
        )
      END AS workload_per_member,
      CASE 
        WHEN LOWER(mg.specialty_category) = LOWER($2) THEN 1
        WHEN mg.specialty_category IS NULL THEN 2
        ELSE 3
      END AS specialty_rank
    FROM organization_maintenance_groups omg
    JOIN maintenance_groups mg ON omg.group_id = mg.id
    LEFT JOIN maintenance_group_members mgm ON mg.id = mgm.group_id
    LEFT JOIN ticket_assignments ta ON mg.id = ta.group_id
    WHERE omg.organization_id = $1
      AND omg.status = 'ACTIVE'
    GROUP BY mg.id
    ORDER BY 
      specialty_rank ASC,
      workload_per_member ASC,
      active_tickets_count ASC;
  `;

  const { rows: groups } = await pool.query(groupsQuery, [organizationId, category]);

  return {
    ticketId,
    category,
    organizationId,
    recommendedGroup: groups[0] || null,
    availableGroups: groups
  };
};

// 5. Stage 2: Cascading Dispatch (Management/Auto picks Group -> Server auto-picks least-busy Member)
export const assignTicketTransaction = async ({ ticketId, groupId = null, assignedBy }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock ticket row & get its category + owning organization_id
    const ticketMetaQuery = `
      SELECT 
        t.status,
        t.category,
        r.organization_id
      FROM tickets t
      JOIN assets a ON t.asset_id = a.id
      JOIN sites s ON a.site_id = s.id
      JOIN regions r ON s.region_id = r.id
      WHERE t.id = $1
      FOR UPDATE OF t;
    `;
    const { rows: existing } = await client.query(ticketMetaQuery, [ticketId]);
    if (!existing[0]) throw new Error('TICKET_NOT_FOUND');

    const { status: oldStatus, category, organization_id: organizationId } = existing[0];
    let targetGroupId = groupId;

    if (targetGroupId) {
      // Mode B (Manual Group Selection): Verify this group has an ACTIVE handshake with the ticket's Organization
      if (organizationId) {
        const { rows: linkRows } = await client.query(
          `SELECT id FROM organization_maintenance_groups
           WHERE organization_id = $1 AND group_id = $2 AND status = 'ACTIVE';`,
          [organizationId, targetGroupId]
        );
        if (!linkRows[0]) {
          throw new Error('GROUP_NOT_CONTRACTED');
        }
      }
    } else {
      // Mode A (Full Auto-Assign): Server picks the best active contracted group
      const autoGroupQuery = `
        SELECT mg.id AS group_id
        FROM organization_maintenance_groups omg
        JOIN maintenance_groups mg ON omg.group_id = mg.id
        LEFT JOIN maintenance_group_members mgm ON mg.id = mgm.group_id
        LEFT JOIN ticket_assignments ta ON mg.id = ta.group_id
        WHERE omg.organization_id = $1
          AND omg.status = 'ACTIVE'
        GROUP BY mg.id
        HAVING COUNT(DISTINCT mgm.user_id) > 0
        ORDER BY 
          CASE 
            WHEN LOWER(mg.specialty_category) = LOWER($2) THEN 1
            WHEN mg.specialty_category IS NULL THEN 2
            ELSE 3
          END ASC,
          (COUNT(DISTINCT ta.id) FILTER (WHERE ta.status IN ('DISPATCHED', 'ACCEPTED'))::numeric 
           / GREATEST(COUNT(DISTINCT mgm.user_id), 1)::numeric) ASC,
          COUNT(DISTINCT ta.id) FILTER (WHERE ta.status IN ('DISPATCHED', 'ACCEPTED')) ASC
        LIMIT 1;
      `;
      const { rows: autoGroupRows } = await client.query(autoGroupQuery, [organizationId, category]);
      if (!autoGroupRows[0]) {
        throw new Error('NO_ACTIVE_MAINTENANCE_GROUP');
      }
      targetGroupId = autoGroupRows[0].group_id;
    }

    // Inside the selected Maintenance Group, auto-pick the least-busy worker
    const leastBusyWorkerQuery = `
      SELECT 
        mgm.user_id,
        u.full_name,
        u.email,
        u.phone_number,
        COUNT(ta.id) FILTER (WHERE ta.status IN ('DISPATCHED', 'ACCEPTED'))::int AS active_load,
        MAX(ta.assigned_at) AS last_assigned_at
      FROM maintenance_group_members mgm
      JOIN users u ON mgm.user_id = u.id
      LEFT JOIN ticket_assignments ta ON mgm.user_id = ta.assignee_id
      WHERE mgm.group_id = $1
        AND COALESCE(LOWER(u.acc_status), 'active') = 'active'
      GROUP BY mgm.user_id, u.full_name, u.email, u.phone_number
      ORDER BY active_load ASC, last_assigned_at ASC NULLS FIRST
      LIMIT 1;
    `;
    const { rows: workerRows } = await client.query(leastBusyWorkerQuery, [targetGroupId]);
    const selectedWorker = workerRows[0] || null;
    const assigneeId = selectedWorker ? selectedWorker.user_id : null;

    // Insert assignment record with both group_id and auto-selected assignee_id
    const { rows: assignmentRows } = await client.query(
      `INSERT INTO ticket_assignments (ticket_id, group_id, assignee_id, assigned_by, status)
       VALUES ($1, $2, $3, $4, 'DISPATCHED')
       RETURNING *;`,
      [ticketId, targetGroupId, assigneeId, assignedBy]
    );

    const { rows: updatedTicket } = await client.query(
      `UPDATE tickets 
       SET status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *;`,
      [ticketId]
    );

    await client.query(
      `INSERT INTO ticket_audit_logs (ticket_id, actor_id, action_type, old_value, new_value)
       VALUES ($1, $2, 'DISPATCHED_TO_GROUP', $3, 'ASSIGNED');`,
      [ticketId, assignedBy, oldStatus]
    );

    await client.query('COMMIT');
    return {
      dispatchMode: groupId ? 'MANUAL_GROUP_AUTO_MEMBER' : 'FULL_AUTO',
      ticket: updatedTicket[0],
      assignment: assignmentRows[0],
      assignedWorker: selectedWorker
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 6. Stage 3: Worker Starts Field Work (ASSIGNED -> IN_PROGRESS)
export const startWorkTransaction = async ({ ticketId, workerId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(`SELECT status FROM tickets WHERE id = $1 FOR UPDATE;`, [ticketId]);
    if (!existing[0]) throw new Error('TICKET_NOT_FOUND');
    const oldStatus = existing[0].status;

    await client.query(
      `UPDATE ticket_assignments
       SET status = 'ACCEPTED', started_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND status = 'DISPATCHED';`,
      [ticketId]
    );

    const { rows: updatedTicket } = await client.query(
      `UPDATE tickets SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;`,
      [ticketId]
    );

    await client.query(
      `INSERT INTO ticket_audit_logs (ticket_id, actor_id, action_type, old_value, new_value)
       VALUES ($1, $2, 'STATUS_CHANGED', $3, 'IN_PROGRESS');`,
      [ticketId, workerId, oldStatus]
    );

    await client.query('COMMIT');
    return updatedTicket[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 7. Stage 4: Worker Resolves & Submits for Verification (IN_PROGRESS -> PENDING_VERIFICATION)
export const resolveTicketTransaction = async ({
  ticketId,
  workerId,
  resolutionNotes,
  afterMediaUrl = null
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(`SELECT status FROM tickets WHERE id = $1 FOR UPDATE;`, [ticketId]);
    if (!existing[0]) throw new Error('TICKET_NOT_FOUND');
    const oldStatus = existing[0].status;

    await client.query(
      `UPDATE ticket_assignments
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND status IN ('DISPATCHED', 'ACCEPTED');`,
      [ticketId]
    );

    const { rows: updatedTicket } = await client.query(
      `UPDATE tickets
       SET status = 'PENDING_VERIFICATION',
           resolution_notes = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *;`,
      [resolutionNotes, ticketId]
    );

    let media = null;
    if (afterMediaUrl) {
      const { rows: mediaRows } = await client.query(
        `INSERT INTO ticket_media (ticket_id, media_url, media_type, evidence_stage, uploaded_by)
         VALUES ($1, $2, 'field_photo', 'AFTER', $3)
         RETURNING *;`,
        [ticketId, afterMediaUrl, workerId]
      );
      media = mediaRows[0];
    }

    await client.query(
      `INSERT INTO ticket_audit_logs (ticket_id, actor_id, action_type, old_value, new_value)
       VALUES ($1, $2, 'SUBMITTED_FOR_VERIFICATION', $3, 'PENDING_VERIFICATION');`,
      [ticketId, workerId, oldStatus]
    );

    await client.query('COMMIT');
    return { ticket: updatedTicket[0], afterMedia: media };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 8. Stage 5: Management Approves (or Rejects) Verification
// If APPROVED -> Trigger automatically flips Asset back to 'CLEAR' + writes AssetMaintenanceLog!
export const verifyTicketTransaction = async ({ ticketId, managerId, approved, rejectionReason = null }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(`SELECT * FROM tickets WHERE id = $1 FOR UPDATE;`, [ticketId]);
    if (!existing[0]) throw new Error('TICKET_NOT_FOUND');
    const ticket = existing[0];

    const newStatus = approved ? 'APPROVED' : 'IN_PROGRESS';

    const { rows: updatedRows } = await client.query(
      `UPDATE tickets
       SET status = $1,
           verified_by = $2,
           verified_at = CURRENT_TIMESTAMP,
           resolution_notes = CASE WHEN $3::text IS NOT NULL THEN resolution_notes || ' | [REJECTED]: ' || $3 ELSE resolution_notes END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *;`,
      [newStatus, managerId, rejectionReason, ticketId]
    );

    await client.query(
      `INSERT INTO ticket_audit_logs (ticket_id, actor_id, action_type, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5);`,
      [
        ticketId,
        managerId,
        approved ? 'MANAGEMENT_APPROVED' : 'MANAGEMENT_REJECTED',
        ticket.status,
        newStatus
      ]
    );

    if (approved) {
      await client.query(
        `INSERT INTO asset_maintenance_logs (asset_id, ticket_id, maintenance_type, performed_by, notes)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          ticket.asset_id,
          ticket.id,
          ticket.category,
          managerId,
          ticket.resolution_notes || 'Ticket resolved and approved by management.'
        ]
      );
    } else {
      await client.query(
        `UPDATE ticket_assignments SET status = 'REJECTED_BY_MGMT' WHERE ticket_id = $1;`,
        [ticketId]
      );
    }

    await client.query('COMMIT');
    return updatedRows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};