import { pool } from '../../config/db.js';

// D5: generic audit trail for non-ticket state changes. Ticket lifecycle
// actions remain in ticket_audit_logs (the canonical ticket audit).
// Audit write failures are logged but do not fail the user action; the
// operational action has already been applied.
export const recordAuditEvent = async ({
  actorId = null,
  organizationId = null,
  actionType,
  resourceType,
  resourceId = null,
  metadata = {}
}) => {
  try {
    await pool.query(
      `INSERT INTO public.audit_events
         (actor_id, organization_id, action_type, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [actorId, organizationId, actionType, resourceType, resourceId, metadata]
    );
  } catch (error) {
    console.error('Audit write failed:', error.message);
  }
};
