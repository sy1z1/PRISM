import { Router } from 'express';
import {
  createTicket,
  getTicket,
  listAssetTickets,
  getDispatchOptions,
  assignTicket,
  startTicketWork,
  resolveTicket,
  verifyTicket
} from './tickets.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';
import { upload } from '../../middlewares/upload.guard.js';

const router = Router();

// Stage 1: Create Ticket (supports optional 'ticketMedia' BEFORE photo upload)
router.post('/', requireAuth, upload.single('ticketMedia'), createTicket);

// Get all tickets for a specific asset
router.get('/asset/:assetId', requireAuth, listAssetTickets);

// Stage 2A: Get Auto-Suggested Maintenance Group + All Active Contracted Groups for a ticket
router.get('/:ticketId/dispatch-options', requireAuth, getDispatchOptions);

// Get full details of a single ticket
router.get('/:ticketId', requireAuth, getTicket);

// Stage 2B: Dispatch ticket (Send {} for Full Auto-Assign, or { "groupId": "..." } for Manual Group + Auto Worker)
router.post('/:ticketId/assign', requireAuth, assignTicket);

// Stage 3: Technician accepts and starts repair work
router.patch('/:ticketId/start', requireAuth, startTicketWork);

// Stage 4: Technician submits repair + optional 'ticketMedia' AFTER photo -> PENDING_VERIFICATION
router.patch('/:ticketId/resolve', requireAuth, upload.single('ticketMedia'), resolveTicket);

// Stage 5: Management approves (or rejects) -> APPROVED -> Asset pin turns Green (CLEAR)!
router.patch('/:ticketId/verify', requireAuth, verifyTicket);

export default router;