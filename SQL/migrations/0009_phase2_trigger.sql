-- 0009_phase2_trigger.sql
-- Make asset-status derivation atomic and conditional.
-- - Locks the target asset row before counting active tickets.
-- - Handles asset_id changes by recalculating the previous asset.
-- - Skips the UPDATE when the status is unchanged.
-- - Extends the trigger to UPDATE OF status, asset_id.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_asset_status_from_tickets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    target_asset uuid := COALESCE(NEW.asset_id, OLD.asset_id);
    next_status text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
        PERFORM 1 FROM assets WHERE id = OLD.asset_id FOR UPDATE;
        SELECT CASE WHEN EXISTS (
                 SELECT 1 FROM tickets
                 WHERE asset_id = OLD.asset_id
                   AND status NOT IN ('APPROVED', 'CANCELLED')
               ) THEN 'MAINTENANCE PENDING' ELSE 'CLEAR'
               END INTO next_status;
        UPDATE assets
           SET status = next_status
         WHERE id = OLD.asset_id
           AND status IS DISTINCT FROM next_status;
    END IF;

    PERFORM 1 FROM assets WHERE id = target_asset FOR UPDATE;

    SELECT CASE WHEN EXISTS (
             SELECT 1 FROM tickets
             WHERE asset_id = target_asset
               AND status NOT IN ('APPROVED', 'CANCELLED')
           ) THEN 'MAINTENANCE PENDING' ELSE 'CLEAR'
           END INTO next_status;

    UPDATE assets
       SET status = next_status
     WHERE id = target_asset
       AND status IS DISTINCT FROM next_status;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_asset_status ON public.tickets;
CREATE TRIGGER trg_sync_asset_status
AFTER INSERT OR DELETE OR UPDATE OF status, asset_id ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_asset_status_from_tickets();

COMMIT;
