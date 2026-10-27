import {
  reportIssue,
  fetchTicketDetails,
  fetchAssetTickets,
  fetchDispatchOptions,
  dispatchTicket,
  acceptAndStartTicket,
  submitForVerification,
  managementVerifyTicket
} from './tickets.service.js';

// 1. POST /api/tickets (Stage 1: Report Issue -> Status: OPEN -> Asset: MAINTENANCE PENDING)
export const createTicket = async (req, res) => {
  try {
    const { assetId, category, priority, description, mediaType } = req.body || {};
    const reportedBy = req.user?.userId || req.user?.id || null;

    if (!assetId || !category || !description) {
      return res.status(400).json({ error: 'assetId, category, and description are required.' });
    }

    const mediaUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null;

    const result = await reportIssue({
      assetId,
      reportedBy,
      category,
      priority,
      description,
      mediaUrl,
      mediaType: mediaType || 'field_photo'
    });

    res.status(201).json({
      message: 'Maintenance ticket created! Asset status is now MAINTENANCE PENDING.',
      ...result
    });
  } catch (error) {
    if (error.message === 'ASSET_NOT_FOUND') {
      return res.status(404).json({ error: 'Target asset not found.' });
    }
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. GET /api/tickets/:ticketId (View Full Ticket + Media + Audit History)
export const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await fetchTicketDetails(ticketId);
    res.status(200).json(ticket);
  } catch (error) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. GET /api/tickets/asset/:assetId (List all tickets for an asset)
export const listAssetTickets = async (req, res) => {
  try {
    const { assetId } = req.params;
    const tickets = await fetchAssetTickets(assetId);
    res.status(200).json({ count: tickets.length, tickets });
  } catch (error) {
    console.error('Error fetching asset tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. GET /api/tickets/:ticketId/dispatch-options (Suggests Best Maintenance Group + Lists All Contracted Groups)
export const getDispatchOptions = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const options = await fetchDispatchOptions(ticketId);
    res.status(200).json(options);
  } catch (error) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    console.error('Error fetching dispatch options:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 5. POST /api/tickets/:ticketId/assign (Stage 2: Cascading Dispatch to Group + Auto-Pick Least-Busy Worker)
export const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    // groupId is optional! If omitted, the server auto-selects the least-loaded active contracted group.
    const { groupId = null } = req.body || {};
    const assignedBy = req.user?.userId || req.user?.id || null;

    const result = await dispatchTicket({ ticketId, groupId, assignedBy });

    res.status(200).json({
      message: groupId
        ? 'Ticket dispatched to selected Maintenance Group and auto-assigned to least-busy technician.'
        : 'Ticket auto-dispatched to recommended Maintenance Group and least-busy technician.',
      ...result
    });
  } catch (error) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    if (error.message === 'GROUP_NOT_CONTRACTED') {
      return res.status(403).json({
        error: 'This Maintenance Group does not have an ACTIVE handshake link with the asset owning Organization.'
      });
    }
    if (error.message === 'NO_ACTIVE_MAINTENANCE_GROUP') {
      return res.status(400).json({
        error: 'No active contracted Maintenance Groups (with registered members) found for this Organization.'
      });
    }
    console.error('Error assigning ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 6. PATCH /api/tickets/:ticketId/start (Stage 3: Worker Accepts & Starts -> Status: IN_PROGRESS)
export const startTicketWork = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const workerId = req.user?.userId || req.user?.id || null;

    const ticket = await acceptAndStartTicket({ ticketId, workerId });
    res.status(200).json({ message: 'Work started on ticket.', ticket });
  } catch (error) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    console.error('Error starting ticket work:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 7. PATCH /api/tickets/:ticketId/resolve (Stage 4: Worker Finishes -> Status: PENDING_VERIFICATION)
export const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolutionNotes } = req.body || {};
    const workerId = req.user?.userId || req.user?.id || null;

    if (!resolutionNotes) {
      return res.status(400).json({ error: 'resolutionNotes are required when submitting for verification.' });
    }

    const afterMediaUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null;

    const result = await submitForVerification({
      ticketId,
      workerId,
      resolutionNotes,
      afterMediaUrl
    });

    res.status(200).json({
      message: 'Ticket resolved by technician and submitted for management verification! (Asset remains MAINTENANCE PENDING until approved).',
      ...result
    });
  } catch (error) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    console.error('Error resolving ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 8. PATCH /api/tickets/:ticketId/verify (Stage 5: Management Approves -> Status: APPROVED -> Asset: CLEAR!)
export const verifyTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { approved, rejectionReason } = req.body || {};
    const managerId = req.user?.userId || req.user?.id || null;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean true or false) is required.' });
    }

    const ticket = await managementVerifyTicket({
      ticketId,
      managerId,
      approved,
      rejectionReason
    });

    res.status(200).json({
      message: approved
        ? 'Ticket APPROVED by management! Maintenance log recorded and Asset status synced to CLEAR.'
        : 'Ticket REJECTED by management and returned to IN_PROGRESS.',
      ticket
    });
  } catch (error) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    console.error('Error verifying ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};