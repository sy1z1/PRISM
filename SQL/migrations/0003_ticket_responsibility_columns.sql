-- 0003_ticket_responsibility_columns.sql
-- Purpose: canonical current group, acknowledgement/completion actors, reopen
-- counter, audit notes, and query indexes. Additive only; no columns dropped.
-- REVIEW REQUIRED before execution.

BEGIN;

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS maintenance_group_id uuid REFERENCES public.maintenance_groups(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
    ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.ticket_audit_logs
    ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS ix_tickets_group_status
    ON public.tickets (maintenance_group_id, status);

CREATE INDEX IF NOT EXISTS ix_ticket_assignments_ticket
    ON public.ticket_assignments (ticket_id);

CREATE INDEX IF NOT EXISTS ix_ticket_audit_ticket_time
    ON public.ticket_audit_logs (ticket_id, logged_at);

COMMIT;
