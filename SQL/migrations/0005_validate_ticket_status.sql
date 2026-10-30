-- 0005_validate_ticket_status.sql
-- Purpose: validate the status CHECK after live data has been confirmed clean.
-- PRECONDITION: every tickets.status value is one of the allowed values (check
-- with the read-only query in the Stage 3 report). Do NOT run before that check.
-- REVIEW REQUIRED.

BEGIN;

ALTER TABLE public.tickets VALIDATE CONSTRAINT ck_tickets_status;

COMMIT;
