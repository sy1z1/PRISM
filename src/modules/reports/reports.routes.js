import { Router } from 'express';
import { getSummary, getTicketsCsv } from './reports.controller.js';
import { requireAuth } from '../../middlewares/auth.guard.js';

const router = Router();

// Management: organization-scoped (SuperAdmin: all). Supervisors: group-scoped.
router.get('/summary', requireAuth, getSummary);
router.get('/tickets.csv', requireAuth, getTicketsCsv);

export default router;
