import * as reportsModel from './reports.model.js';
import { getOrganizationScope, isManagementUser } from '../authorization/policy.js';
import { getSupervisorGroupIds } from '../authorization/authorization.model.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseFrom = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'INVALID' : date.toISOString();
};

const parseTo = (value) => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'INVALID' : date.toISOString();
};

const resolveScope = async (req, res) => {
  if (isManagementUser(req.user)) {
    const organizationId = getOrganizationScope(req.user);
    if (organizationId === undefined) {
      res.status(403).json({ error: 'NO_ORGANIZATION_SCOPE' });
      return null;
    }
    return { organizationId, groupIds: null, requireActiveGroupLink: false, isManagement: true };
  }

  const groupIds = await getSupervisorGroupIds(req.user.userId);
  if (!groupIds.length) {
    res.status(403).json({ error: 'NO_SUPERVISED_GROUPS' });
    return null;
  }
  return {
    organizationId: undefined,
    groupIds,
    requireActiveGroupLink: true,
    isManagement: false
  };
};

const buildScope = async (req, res) => {
  const base = await resolveScope(req, res);
  if (!base) return null;

  const { from, to, siteId, groupId } = req.query;

  const fromIso = parseFrom(from);
  const toIso = parseTo(to);
  if (fromIso === 'INVALID' || toIso === 'INVALID') {
    res.status(400).json({ error: 'INVALID_DATE_RANGE' });
    return null;
  }
  if (siteId && !UUID_PATTERN.test(String(siteId))) {
    res.status(400).json({ error: 'INVALID_SITE_ID' });
    return null;
  }
  if (groupId && !UUID_PATTERN.test(String(groupId))) {
    res.status(400).json({ error: 'INVALID_GROUP_ID' });
    return null;
  }

  return {
    ...base,
    from: fromIso,
    to: toIso,
    siteId: siteId ? String(siteId) : null,
    groupId: groupId ? String(groupId) : null
  };
};

export const getSummary = async (req, res) => {
  try {
    const scope = await buildScope(req, res);
    if (!scope) return;

    const summary = await reportsModel.getSummary(scope);
    res.status(200).json({
      scope: {
        organizationId: scope.organizationId ?? null,
        from: scope.from,
        to: scope.to,
        siteId: scope.siteId,
        groupId: scope.groupId
      },
      ...summary
    });
  } catch (error) {
    console.error('Error building report summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\r\n]/.test(text) ? `"${text}"` : text;
};

const CSV_COLUMNS = [
  'ticket_number',
  'asset_name',
  'site_name',
  'organization_name',
  'group_name',
  'group_code',
  'category',
  'priority',
  'status',
  'created_at',
  'acknowledged_at',
  'completed_at',
  'verified_at',
  'reopen_count',
  'resolution_notes'
];

export const getTicketsCsv = async (req, res) => {
  try {
    const scope = await buildScope(req, res);
    if (!scope) return;

    const rows = await reportsModel.getTicketRows(scope);
    const lines = [CSV_COLUMNS.join(',')];
    for (const row of rows) {
      lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(','));
    }

    const csv = `\uFEFF${lines.join('\r\n')}\r\n`;
    const fileName = `prism-tickets-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting tickets CSV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
