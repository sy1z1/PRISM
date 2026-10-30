-- 0011_phase2_audit.sql
-- D2/D5: one role per user; generic audit trail for non-ticket state changes
-- (360 captures, hotspots, thumbnails, group linking, user administration).

BEGIN;

-- Exactly one role per user (D2).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_one_role
  ON public.user_roles (user_id);

CREATE TABLE IF NOT EXISTS public.audit_events (
    id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    actor_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
    action_type character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_audit_events_created_at
  ON public.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_resource
  ON public.audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_actor
  ON public.audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_organization
  ON public.audit_events (organization_id, created_at DESC);

COMMIT;
