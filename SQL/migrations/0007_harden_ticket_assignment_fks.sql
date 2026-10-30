-- 0007_harden_ticket_assignment_fks.sql
-- Purpose: protect historical assignment records by changing
-- ticket_assignments.group_id and assignee_id from ON DELETE CASCADE to
-- ON DELETE RESTRICT. Constraint replacement only; no column or data change.
-- Owner-approved (S3-FK-01). REVIEW REQUIRED before execution.
-- Idempotent: drops the named constraints if present, then recreates them.

BEGIN;

ALTER TABLE public.ticket_assignments
    DROP CONSTRAINT IF EXISTS ticket_assignments_group_id_fkey;
ALTER TABLE public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.maintenance_groups(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_assignments
    DROP CONSTRAINT IF EXISTS ticket_assignments_assignee_id_fkey;
ALTER TABLE public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE RESTRICT;

COMMIT;
