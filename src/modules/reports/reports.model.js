import { pool } from '../../config/db.js';

const buildScope = ({
  organizationId,
  groupIds,
  requireActiveGroupLink,
  from,
  to,
  siteId,
  groupId
}) => {
  const params = [];
  const conditions = [];

  if (organizationId !== undefined && organizationId !== null) {
    params.push(organizationId);
    conditions.push(`r.organization_id = $${params.length}`);
  }
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
  if (from) {
    params.push(from);
    conditions.push(`t.created_at >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    conditions.push(`t.created_at <= $${params.length}::timestamptz`);
  }
  if (siteId) {
    params.push(siteId);
    conditions.push(`a.site_id = $${params.length}`);
  }
  if (groupId) {
    params.push(groupId);
    conditions.push(`t.maintenance_group_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const cte = `
    WITH scoped AS (
      SELECT
        t.*,
        a.site_id,
        a.name_identifier AS asset_name,
        a.status AS asset_status,
        s.name AS site_name,
        r.organization_id,
        o.name AS organization_name,
        mg.name AS group_name,
        mg.group_code
      FROM tickets t
      JOIN assets a ON t.asset_id = a.id
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN regions r ON s.region_id = r.id
      LEFT JOIN organizations o ON o.id = r.organization_id
      LEFT JOIN maintenance_groups mg ON t.maintenance_group_id = mg.id
      ${where}
    )
  `;
  return { params, cte };
};

export const getSummary = async (scope) => {
  const { params, cte } = buildScope(scope);

  const totalsQuery = `${cte}
    SELECT
      count(*)::int AS total_tickets,
      count(*) FILTER (WHERE status NOT IN ('APPROVED', 'CANCELLED'))::int AS active_tickets,
      count(*) FILTER (WHERE status = 'PENDING_VERIFICATION')::int AS pending_verification,
      count(*) FILTER (WHERE status = 'APPROVED')::int AS approved_tickets,
      count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_tickets,
      count(*) FILTER (WHERE reopen_count > 0)::int AS reopened_tickets,
      round(avg(EXTRACT(EPOCH FROM (acknowledged_at::timestamptz - created_at)))::numeric / 3600.0, 2) AS avg_ack_hours,
      round(avg(EXTRACT(EPOCH FROM (completed_at::timestamptz - created_at)))::numeric / 3600.0, 2) AS avg_resolution_hours,
      round(avg(EXTRACT(EPOCH FROM (verified_at::timestamptz - created_at)))::numeric / 3600.0, 2) AS avg_approval_hours
    FROM scoped;`;

  const statusQuery = `${cte}
    SELECT status, count(*)::int AS count
    FROM scoped
    GROUP BY status
    ORDER BY count DESC;`;

  const priorityQuery = `${cte}
    SELECT priority, count(*)::int AS count
    FROM scoped
    GROUP BY priority
    ORDER BY count DESC;`;

  const groupQuery = `${cte}
    SELECT
      group_name,
      group_code,
      count(*)::int AS tickets,
      count(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
      count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
      count(*) FILTER (WHERE reopen_count > 0)::int AS reopened,
      round(avg(EXTRACT(EPOCH FROM (completed_at::timestamptz - created_at)))::numeric / 3600.0, 2) AS avg_resolution_hours
    FROM scoped
    WHERE maintenance_group_id IS NOT NULL
    GROUP BY group_name, group_code
    ORDER BY tickets DESC, group_name ASC;`;

  const assetsWithTicketsQuery = `${cte}
    SELECT count(DISTINCT asset_id)::int AS assets_with_tickets
    FROM scoped;`;

  const [totals, statuses, priorities, groups, assetsWithTickets] = await Promise.all([
    pool.query(totalsQuery, params),
    pool.query(statusQuery, params),
    pool.query(priorityQuery, params),
    pool.query(groupQuery, params),
    pool.query(assetsWithTicketsQuery, params)
  ]);

  const totalRow = totals.rows[0] || {};
  const reopened = Number(totalRow.reopened_tickets || 0);
  const total = Number(totalRow.total_tickets || 0);

  let assetStats = { total_assets: null, clear_assets: null, in_maintenance_assets: null };
  if (scope.isManagement) {
    const assetParams = [];
    const assetConditions = [];
    if (scope.organizationId !== undefined && scope.organizationId !== null) {
      assetParams.push(scope.organizationId);
      assetConditions.push(`r.organization_id = $${assetParams.length}`);
    }
    if (scope.siteId) {
      assetParams.push(scope.siteId);
      assetConditions.push(`a.site_id = $${assetParams.length}`);
    }
    const assetWhere = assetConditions.length ? `WHERE ${assetConditions.join(' AND ')}` : '';
    const assetQuery = `
      SELECT
        count(*)::int AS total_assets,
        count(*) FILTER (WHERE a.status = 'CLEAR')::int AS clear_assets,
        count(*) FILTER (WHERE a.status = 'MAINTENANCE PENDING')::int AS in_maintenance_assets
      FROM assets a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN regions r ON s.region_id = r.id
      ${assetWhere};`;
    const assetResult = await pool.query(assetQuery, assetParams);
    assetStats = assetResult.rows[0] || assetStats;
  }

  return {
    totals: {
      ...totalRow,
      reopen_rate: total > 0 ? Number((reopened / total).toFixed(4)) : 0
    },
    statusBreakdown: statuses.rows,
    priorityBreakdown: priorities.rows,
    groupPerformance: groups.rows,
    assets: {
      ...assetStats,
      ...assetsWithTickets.rows[0]
    }
  };
};

export const getTicketRows = async (scope) => {
  const { params, cte } = buildScope(scope);
  const query = `${cte}
    SELECT
      ticket_number,
      asset_name,
      site_name,
      organization_name,
      group_name,
      group_code,
      category,
      priority,
      status,
      created_at,
      acknowledged_at,
      completed_at,
      verified_at,
      reopen_count,
      resolution_notes
    FROM scoped
    ORDER BY created_at DESC, ticket_number DESC;`;
  const { rows } = await pool.query(query, params);
  return rows;
};
