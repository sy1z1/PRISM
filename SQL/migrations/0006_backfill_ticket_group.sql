-- 0006_backfill_ticket_group.sql
-- Purpose: backfill tickets.maintenance_group_id ONLY where the historical
-- assignment is unambiguous (exactly one distinct group, most recent row).
-- Ambiguous/orphaned tickets are left NULL and must be reported, never guessed.
-- Each backfilled row is logged for exact reversal.
-- REVIEW REQUIRED; run after 0003.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ticket_group_backfill_log (
    ticket_id uuid PRIMARY KEY,
    maintenance_group_id uuid NOT NULL,
    source_assignment_id uuid NOT NULL,
    backfilled_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.ticket_group_backfill_log (ticket_id, maintenance_group_id, source_assignment_id)
SELECT t.id, a.group_id, a.id
FROM public.tickets t
JOIN public.ticket_assignments a
  ON a.ticket_id = t.id
 AND a.group_id IS NOT NULL
WHERE t.maintenance_group_id IS NULL
  AND a.assigned_at = (
      SELECT max(a2.assigned_at)
      FROM public.ticket_assignments a2
      WHERE a2.ticket_id = t.id
        AND a2.group_id IS NOT NULL
  )
  AND (
      SELECT count(DISTINCT a3.group_id)
      FROM public.ticket_assignments a3
      WHERE a3.ticket_id = t.id
        AND a3.group_id IS NOT NULL
  ) = 1
ON CONFLICT (ticket_id) DO NOTHING;

UPDATE public.tickets t
SET maintenance_group_id = l.maintenance_group_id
FROM public.ticket_group_backfill_log l
WHERE l.ticket_id = t.id
  AND t.maintenance_group_id IS NULL;

COMMIT;
