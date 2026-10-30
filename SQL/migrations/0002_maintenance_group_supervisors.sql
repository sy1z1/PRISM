-- 0002_maintenance_group_supervisors.sql
-- Purpose: per-group supervisor authority. Multiple supervisors per group and
-- multiple groups per supervisor are supported. Authority history is preserved
-- via revoked_at (no hard delete).
-- REVIEW REQUIRED before execution. Additive only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.maintenance_group_supervisors (
    id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    group_id uuid NOT NULL REFERENCES public.maintenance_groups(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_supervisor_active
    ON public.maintenance_group_supervisors (group_id, user_id)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_group_supervisor_user_active
    ON public.maintenance_group_supervisors (user_id)
    WHERE revoked_at IS NULL;

COMMIT;
