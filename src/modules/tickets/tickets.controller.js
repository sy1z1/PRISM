import {
  reportIssue,
  fetchTicketDetails,
  fetchAssetTickets,
  fetchDispatchOptions,
  reassignTicket,
  acknowledgeTicket,
  startTicketWork,
  completeTicket,
  verifierDecision,
  cancelTicket,
  reopenTicket,
  fetchTicketQueue
} from './tickets.service.js';
import {
  assertAssetAccess,
  assertNotSelfVerification,
  assertSupervisesTicketGroup,
  assertTicketAccess,
  assertTicketReadableById,
  getReadableGroupFilter,
  sendAuthorizationError
} from '../authorization/resource-access.js';
import { getSupervisorGroupIds, getTicketMeta } from '../authorization/authorization.model.js';
import { isManagementUser } from '../authorization/policy.js';

const ERROR_STATUS = {
  TICKET_NOT_FOUND: 404,
  ASSET_NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  GROUP_REQUIRED: 400,
  GROUP_NOT_CONTRACTED: 400,
  INVALID_TRANSITION: 409,
  RESOLUTION_NOTES_REQUIRED: 400,
  REJECTION_REASON_REQUIRED: 400,
  CANCELLATION_REASON_REQUIRED: 400,
  REOPEN_REASON_REQUIRED: 400,
  NO_SUPERVISED_GROUPS: 403
};

const respondError = (res, error, context) => {
  if (sendAuthorizationError(res, error)) return true;
  const status = ERROR_STATUS[error.message];
  if (status) {
    res.status(status).json({ error: error.message });
    return true;
  }
  console.error(`${context}:`, error);
  res.status(500).json({ error: 'Internal server error' });
  return true;
};

// 1. POST /api/tickets — Management creates a ticket and selects the group.
export const createTicket = async (req, res) => {
  try {
    const { assetId, groupId, category, priority, description, mediaType } = req.body || {};
    const reportedBy = req.user.userId;

    if (!assetId || !groupId || !category || !description) {
      return res.status(400).json({
        error: 'assetId, groupId, category, and description are required.'
      });
    }

    await assertAssetAccess(req.user, assetId);

    const mediaUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null;

    const result = await reportIssue({
      assetId,
      groupId,
      reportedBy,
      category,
      priority,
      description,
      mediaUrl,
      mediaType: mediaType || 'field_photo'
    });

    res.status(201).json({
      message: 'Maintenance ticket created and assigned to the selected maintenance group.',
      ...result
    });
  } catch (error) {
    respondError(res, error, 'Error creating ticket');
  }
};

// 2. GET /api/tickets/:ticketId
export const getTicket = async (req, res) => {
  try {
    await assertTicketReadableById(req.user, req.params.ticketId);
    const ticket = await fetchTicketDetails(req.params.ticketId);
    res.status(200).json(ticket);
  } catch (error) {
    respondError(res, error, 'Error fetching ticket');
  }
};

// 3. GET /api/tickets/asset/:assetId — management sees all; supervisors see
// only their groups' tickets.
export const listAssetTickets = async (req, res) => {
  try {
    const { assetId } = req.params;
    await assertAssetAccess(req.user, assetId);

    const groupFilter = await getReadableGroupFilter(req.user);
    const tickets = await fetchAssetTickets(assetId, groupFilter);
    res.status(200).json({ count: tickets.length, tickets });
  } catch (error) {
    respondError(res, error, 'Error fetching asset tickets');
  }
};

// 4. GET /api/tickets/:ticketId/dispatch-options (management only)
export const getDispatchOptions = async (req, res) => {
  try {
    await assertTicketAccess(req.user, req.params.ticketId);
    const options = await fetchDispatchOptions(req.params.ticketId);
    res.status(200).json(options);
  } catch (error) {
    respondError(res, error, 'Error fetching dispatch options');
  }
};

// 5. POST /api/tickets/:ticketId/assign — management reassigns the group.
export const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { groupId = null } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required to reassign the ticket.' });
    }

    await assertTicketAccess(req.user, ticketId);

    const result = await reassignTicket({
      ticketId,
      groupId,
      assignedBy: req.user.userId
    });

    res.status(200).json({
      message: 'Ticket reassigned to the selected maintenance group.',
      ...result
    });
  } catch (error) {
    respondError(res, error, 'Error reassigning ticket');
  }
};

// 6. POST /api/tickets/:ticketId/acknowledge — group supervisor.
export const acknowledgeTicketHandler = async (req, res) => {
  try {
    const meta = await assertSupervisesTicketGroupById(req, res);
    if (!meta) return;

    const ticket = await acknowledgeTicket({
      ticketId: req.params.ticketId,
      supervisorId: req.user.userId
    });
    res.status(200).json({ message: 'Ticket acknowledged by the maintenance group.', ticket });
  } catch (error) {
    respondError(res, error, 'Error acknowledging ticket');
  }
};

// 7. PATCH /api/tickets/:ticketId/start — group supervisor.
export const startTicketWorkHandler = async (req, res) => {
  try {
    const meta = await assertSupervisesTicketGroupById(req, res);
    if (!meta) return;

    const { note = null } = req.body || {};
    const ticket = await startTicketWork({
      ticketId: req.params.ticketId,
      supervisorId: req.user.userId,
      note
    });
    res.status(200).json({ message: 'Work started on ticket.', ticket });
  } catch (error) {
    respondError(res, error, 'Error starting ticket work');
  }
};

// 8. PATCH /api/tickets/:ticketId/resolve — group supervisor completion.
export const resolveTicket = async (req, res) => {
  try {
    const meta = await assertSupervisesTicketGroupById(req, res);
    if (!meta) return;

    const { resolutionNotes } = req.body || {};
    if (!resolutionNotes) {
      return res.status(400).json({
        error: 'resolutionNotes are required when submitting for verification.'
      });
    }

    const afterMediaUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null;

    const result = await completeTicket({
      ticketId: req.params.ticketId,
      supervisorId: req.user.userId,
      resolutionNotes,
      afterMediaUrl
    });

    res.status(200).json({
      message: 'Completion recorded and submitted for independent verification.',
      ...result
    });
  } catch (error) {
    respondError(res, error, 'Error resolving ticket');
  }
};

// 9. PATCH /api/tickets/:ticketId/verify — independent verifier.
export const verifyTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { approved, rejectionReason } = req.body || {};

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean true or false) is required.' });
    }

    const meta = await assertTicketAccess(req.user, ticketId);
    await assertNotSelfVerification(req.user, meta);

    const ticket = await verifierDecision({
      ticketId,
      verifierId: req.user.userId,
      approved,
      rejectionReason
    });

    res.status(200).json({
      message: approved
        ? 'Ticket APPROVED. Maintenance log recorded and asset status synced by the database trigger.'
        : 'Ticket REJECTED and returned to IN_PROGRESS.',
      ticket
    });
  } catch (error) {
    respondError(res, error, 'Error verifying ticket');
  }
};

// 10. PATCH /api/tickets/:ticketId/cancel — management.
export const cancelTicketHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ error: 'A cancellation reason is required.' });
    }

    await assertTicketAccess(req.user, ticketId);

    const ticket = await cancelTicket({
      ticketId,
      cancelledBy: req.user.userId,
      reason
    });
    res.status(200).json({ message: 'Ticket cancelled.', ticket });
  } catch (error) {
    respondError(res, error, 'Error cancelling ticket');
  }
};

// 11. PATCH /api/tickets/:ticketId/reopen — management, group required.
export const reopenTicketHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { groupId, reason } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required when reopening a ticket.' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'A reopen reason is required.' });
    }

    await assertTicketAccess(req.user, ticketId);

    const ticket = await reopenTicket({
      ticketId,
      reopenedBy: req.user.userId,
      groupId,
      reason
    });
    res.status(200).json({ message: 'Ticket reopened and assigned to the selected group.', ticket });
  } catch (error) {
    respondError(res, error, 'Error reopening ticket');
  }
};

// 12. GET /api/tickets/queue — supervisor queue scoped by supervised groups.
export const getTicketQueue = async (req, res) => {
  try {
    const groupIds = await getSupervisorGroupIds(req.user.userId);
    if (!groupIds.length) {
      return res.status(403).json({ error: 'NO_SUPERVISED_GROUPS' });
    }

    const { status, siteId, priority, q, page, limit } = req.query;
    const result = await fetchTicketQueue({
      groupIds,
      status: status || null,
      siteId: siteId || null,
      priority: priority || null,
      search: q || null,
      page,
      limit
    });

    res.status(200).json({
      ...result,
      isManagement: isManagementUser(req.user)
    });
  } catch (error) {
    respondError(res, error, 'Error fetching ticket queue');
  }
};

// Shared helper: fetch meta, enforce active supervisor authority of the
// ticket's group, and return meta.
async function assertSupervisesTicketGroupById(req, res) {
  const meta = await getTicketMeta(req.params.ticketId);
  if (!meta) {
    res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    return null;
  }
  await assertSupervisesTicketGroup(req.user, meta);
  return meta;
}
