-- 0010_phase2_restrict_fks.sql
-- D5: permanent retention. Destructive cascades are replaced with RESTRICT so
-- tickets, audit, assignments, media, captures, and history cannot be erased by
-- deleting a parent. Actor references also become RESTRICT (deactivate users,
-- never delete them). user_sessions intentionally keeps CASCADE (ephemeral).

BEGIN;

-- Core tenancy chain
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_site_id_fkey;
ALTER TABLE public.assets ADD CONSTRAINT assets_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_region_id_fkey;
ALTER TABLE public.sites ADD CONSTRAINT sites_region_id_fkey
  FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE RESTRICT;

ALTER TABLE public.regions DROP CONSTRAINT IF EXISTS regions_organization_id_fkey;
ALTER TABLE public.regions ADD CONSTRAINT regions_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_organization_id_fkey;
ALTER TABLE public.users ADD CONSTRAINT users_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Ticket history
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_asset_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_assignments DROP CONSTRAINT IF EXISTS ticket_assignments_ticket_id_fkey;
ALTER TABLE public.ticket_assignments ADD CONSTRAINT ticket_assignments_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_audit_logs DROP CONSTRAINT IF EXISTS ticket_audit_logs_ticket_id_fkey;
ALTER TABLE public.ticket_audit_logs ADD CONSTRAINT ticket_audit_logs_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_media DROP CONSTRAINT IF EXISTS ticket_media_ticket_id_fkey;
ALTER TABLE public.ticket_media ADD CONSTRAINT ticket_media_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;

-- Asset history
ALTER TABLE public.asset_captures DROP CONSTRAINT IF EXISTS asset_captures_asset_id_fkey;
ALTER TABLE public.asset_captures ADD CONSTRAINT asset_captures_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.asset_maintenance_logs DROP CONSTRAINT IF EXISTS asset_maintenance_logs_asset_id_fkey;
ALTER TABLE public.asset_maintenance_logs ADD CONSTRAINT asset_maintenance_logs_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.asset_maintenance_logs DROP CONSTRAINT IF EXISTS asset_maintenance_logs_ticket_id_fkey;
ALTER TABLE public.asset_maintenance_logs ADD CONSTRAINT asset_maintenance_logs_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;

ALTER TABLE public.capture_hotspots DROP CONSTRAINT IF EXISTS capture_hotspots_source_capture_id_fkey;
ALTER TABLE public.capture_hotspots ADD CONSTRAINT capture_hotspots_source_capture_id_fkey
  FOREIGN KEY (source_capture_id) REFERENCES public.asset_captures(id) ON DELETE RESTRICT;

ALTER TABLE public.capture_hotspots DROP CONSTRAINT IF EXISTS capture_hotspots_target_asset_id_fkey;
ALTER TABLE public.capture_hotspots ADD CONSTRAINT capture_hotspots_target_asset_id_fkey
  FOREIGN KEY (target_asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.site_capture_logs DROP CONSTRAINT IF EXISTS site_capture_logs_site_id_fkey;
ALTER TABLE public.site_capture_logs ADD CONSTRAINT site_capture_logs_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

-- Contract links
ALTER TABLE public.organization_maintenance_groups
  DROP CONSTRAINT IF EXISTS organization_maintenance_groups_group_id_fkey;
ALTER TABLE public.organization_maintenance_groups
  ADD CONSTRAINT organization_maintenance_groups_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.maintenance_groups(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_maintenance_groups
  DROP CONSTRAINT IF EXISTS organization_maintenance_groups_organization_id_fkey;
ALTER TABLE public.organization_maintenance_groups
  ADD CONSTRAINT organization_maintenance_groups_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Accounts and credentials
ALTER TABLE public.user_credentials DROP CONSTRAINT IF EXISTS user_credentials_user_id_fkey;
ALTER TABLE public.user_credentials ADD CONSTRAINT user_credentials_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

-- Audit actors: deactivate users instead of deleting them.
ALTER TABLE public.asset_captures DROP CONSTRAINT IF EXISTS asset_captures_captured_by_fkey;
ALTER TABLE public.asset_captures ADD CONSTRAINT asset_captures_captured_by_fkey
  FOREIGN KEY (captured_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.asset_maintenance_logs DROP CONSTRAINT IF EXISTS asset_maintenance_logs_performed_by_fkey;
ALTER TABLE public.asset_maintenance_logs ADD CONSTRAINT asset_maintenance_logs_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.capture_hotspots DROP CONSTRAINT IF EXISTS capture_hotspots_created_by_fkey;
ALTER TABLE public.capture_hotspots ADD CONSTRAINT capture_hotspots_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.maintenance_group_supervisors DROP CONSTRAINT IF EXISTS maintenance_group_supervisors_granted_by_fkey;
ALTER TABLE public.maintenance_group_supervisors ADD CONSTRAINT maintenance_group_supervisors_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.maintenance_group_supervisors DROP CONSTRAINT IF EXISTS maintenance_group_supervisors_revoked_by_fkey;
ALTER TABLE public.maintenance_group_supervisors ADD CONSTRAINT maintenance_group_supervisors_revoked_by_fkey
  FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.site_capture_logs DROP CONSTRAINT IF EXISTS site_capture_logs_captured_by_fkey;
ALTER TABLE public.site_capture_logs ADD CONSTRAINT site_capture_logs_captured_by_fkey
  FOREIGN KEY (captured_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_assignments DROP CONSTRAINT IF EXISTS ticket_assignments_assigned_by_fkey;
ALTER TABLE public.ticket_assignments ADD CONSTRAINT ticket_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_audit_logs DROP CONSTRAINT IF EXISTS ticket_audit_logs_actor_id_fkey;
ALTER TABLE public.ticket_audit_logs ADD CONSTRAINT ticket_audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.ticket_media DROP CONSTRAINT IF EXISTS ticket_media_uploaded_by_fkey;
ALTER TABLE public.ticket_media ADD CONSTRAINT ticket_media_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_acknowledged_by_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_acknowledged_by_fkey
  FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_completed_by_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_reported_by_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_verified_by_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_assigned_by_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE RESTRICT;

COMMIT;
