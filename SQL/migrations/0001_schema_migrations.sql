-- 0001_schema_migrations.sql
-- Purpose: track applied migrations. REVIEW REQUIRED before execution.
-- Additive only. Safe to run once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
