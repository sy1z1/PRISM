-- 0008_phase2_indexes.sql
-- Additive indexes for hot paths: ticket-by-asset, tenancy FKs, captures,
-- media, audit, sessions, and file-authorization URL lookups.
-- Safe: no data changes. Non-concurrent to run inside the migration transaction.

BEGIN;

CREATE INDEX IF NOT EXISTS ix_tickets_asset_id ON public.tickets (asset_id);
CREATE INDEX IF NOT EXISTS ix_tickets_asset_status ON public.tickets (asset_id, status);
CREATE INDEX IF NOT EXISTS ix_tickets_group_created
  ON public.tickets (maintenance_group_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_ticket_assignments_group_id ON public.ticket_assignments (group_id);

CREATE INDEX IF NOT EXISTS ix_assets_site_id ON public.assets (site_id);
CREATE INDEX IF NOT EXISTS ix_assets_category_id ON public.assets (category_id);
CREATE INDEX IF NOT EXISTS ix_sites_region_id ON public.sites (region_id);
CREATE INDEX IF NOT EXISTS ix_regions_organization_id ON public.regions (organization_id);

CREATE INDEX IF NOT EXISTS ix_asset_captures_asset_captured
  ON public.asset_captures (asset_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_asset_captures_image_url ON public.asset_captures (image_360_url);
CREATE INDEX IF NOT EXISTS ix_capture_hotspots_target ON public.capture_hotspots (target_asset_id);

CREATE INDEX IF NOT EXISTS ix_ticket_media_ticket_created
  ON public.ticket_media (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS ix_ticket_media_media_url ON public.ticket_media (media_url);

CREATE INDEX IF NOT EXISTS ix_asset_maintenance_logs_asset
  ON public.asset_maintenance_logs (asset_id);
CREATE INDEX IF NOT EXISTS ix_asset_maintenance_logs_ticket
  ON public.asset_maintenance_logs (ticket_id);

CREATE INDEX IF NOT EXISTS ix_assets_image_url ON public.assets (image_url);

CREATE INDEX IF NOT EXISTS ix_user_sessions_expires_at ON public.user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON public.user_sessions (user_id);

COMMIT;
