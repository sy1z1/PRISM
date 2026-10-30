-- 0012_phase2_tenant_uniqueness.sql
-- D6: strict multi-tenant isolation.
-- - sites gains organization_id (backfilled from regions).
-- - regions unique by (organization_id, lower(name)); sites by (organization_id, site_code).
-- - tenancy chain and asset category become NOT NULL (pre-checked: no NULLs live).
-- - one latest capture per asset enforced by a partial unique index.

BEGIN;

-- 1. sites.organization_id
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.sites s
SET organization_id = r.organization_id
FROM public.regions r
WHERE s.region_id = r.id
  AND s.organization_id IS NULL;

ALTER TABLE public.sites
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_organization_id_fkey;
ALTER TABLE public.sites ADD CONSTRAINT sites_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- 2. Per-tenant uniqueness
ALTER TABLE public.regions DROP CONSTRAINT IF EXISTS regions_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_regions_org_name
  ON public.regions (organization_id, lower(name));

ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_site_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_org_site_code
  ON public.sites (organization_id, site_code);

-- 3. Tenancy chain NOT NULL
ALTER TABLE public.regions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.sites ALTER COLUMN region_id SET NOT NULL;
ALTER TABLE public.assets ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE public.assets ALTER COLUMN category_id SET NOT NULL;

-- 4. One latest capture per asset
ALTER TABLE public.asset_captures ALTER COLUMN is_latest SET NOT NULL;
ALTER TABLE public.asset_captures ALTER COLUMN is_latest SET DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_captures_latest
  ON public.asset_captures (asset_id)
  WHERE is_latest;

COMMIT;
