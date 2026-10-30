-- 0004_ticket_status_check.sql
-- Purpose: constrain ticket statuses. NOT VALID so legacy rows with unexpected
-- values do not block the migration. Validation is a separate step.
-- REVIEW REQUIRED before execution.

BEGIN;

ALTER TABLE public.tickets
    ADD CONSTRAINT ck_tickets_status CHECK (
        status IN (
            'OPEN',
            'ASSIGNED',
            'ACKNOWLEDGED',
            'IN_PROGRESS',
            'PENDING_VERIFICATION',
            'APPROVED',
            'CANCELLED'
        )
    ) NOT VALID;

COMMIT;
