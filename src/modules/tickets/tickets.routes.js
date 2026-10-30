import { Router } from 'express';
import {
  createTicket,
  getTicket,
  listAssetTickets,
  getDispatchOptions,
  assignTicket,
  acknowledgeTicketHandler,
  startTicketWorkHandler,
  resolveTicket,
  verifyTicket,
  cancelTicketHandler,
  reopenTicketHandler,
  getTicketQueue
} from './tickets.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { requireRole } from '../../middlewares/rbac.guard.js';
import { upload } from '../../middlewares/upload.guard.js';
import { MANAGEMENT_ROLES } from '../authorization/policy.js';

const router = Router();

// Management: create with a required maintenance group.
router.post('/', requireAuth, requireRole(MANAGEMENT_ROLES), upload.single('ticketMedia'), createTicket);

// Supervisor queue (must precede /:ticketId).
router.get('/queue', requireAuth, getTicketQueue);

// Tickets for an asset.
router.get('/asset/:assetId', requireAuth, listAssetTickets);

// Management dispatch options.
router.get('/:ticketId/dispatch-options', requireAuth, requireRole(MANAGEMENT_ROLES), getDispatchOptions);

// Ticket detail.
router.get('/:ticketId', requireAuth, getTicket);

// Management: reassign the responsible group.
router.post('/:ticketId/assign', requireAuth, requireRole(MANAGEMENT_ROLES), assignTicket);

// Group supervisor actions (authority enforced from maintenance_group_supervisors).
router.post('/:ticketId/acknowledge', requireAuth, acknowledgeTicketHandler);
router.patch('/:ticketId/start', requireAuth, startTicketWorkHandler);
router.patch('/:ticketId/resolve', requireAuth, upload.single('ticketMedia'), resolveTicket);

// Independent verification and management terminal actions.
router.patch('/:ticketId/verify', requireAuth, requireRole(MANAGEMENT_ROLES), verifyTicket);
router.patch('/:ticketId/cancel', requireAuth, requireRole(MANAGEMENT_ROLES), cancelTicketHandler);
router.patch('/:ticketId/reopen', requireAuth, requireRole(MANAGEMENT_ROLES), reopenTicketHandler);

export default router;
