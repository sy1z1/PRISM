-- 0013_phase2_reconcile_asset_status.sql
-- One-time reconciliation of assets.status against the deterministic trigger
-- rule. Removes pre-existing drift left by the non-atomic trigger.
-- Idempotent: only rows that differ are updated.

BEGIN;

UPDATE public.assets a
SET status = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.asset_id = a.id
      AND t.status NOT IN ('APPROVED', 'CANCELLED')
  ) THEN 'MAINTENANCE PENDING'
  ELSE 'CLEAR'
END
WHERE a.status IS DISTINCT FROM (
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.asset_id = a.id
        AND t.status NOT IN ('APPROVED', 'CANCELLED')
    ) THEN 'MAINTENANCE PENDING'
    ELSE 'CLEAR'
  END
);

COMMIT;
