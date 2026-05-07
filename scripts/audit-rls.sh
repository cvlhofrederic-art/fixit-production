#!/usr/bin/env bash
# Dump every public-schema RLS policy + RLS-status flag as JSON.
# Read-only. Output is intended for docs/rls-audit.json (not versioned).
#
# Usage:
#   ./scripts/audit-rls.sh > docs/rls-audit.json
#
# Requires either DATABASE_URL or SUPABASE_DB_URL in env.

set -euo pipefail

DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "DATABASE_URL or SUPABASE_DB_URL must be set" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required" >&2
  exit 1
fi

psql "$DB_URL" -At <<'SQL'
WITH tables AS (
  SELECT
    n.nspname AS schema,
    c.relname AS table,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
), policies AS (
  SELECT
    schemaname AS schema,
    tablename AS table,
    policyname AS policy,
    cmd,
    qual,
    with_check
  FROM pg_policies
  WHERE schemaname = 'public'
)
SELECT json_build_object(
  'generated_at', now()::text,
  'tables', (
    SELECT json_agg(json_build_object(
      'name', t.table,
      'rls_enabled', t.rls_enabled,
      'policies', COALESCE((
        SELECT json_agg(json_build_object(
          'name', p.policy,
          'cmd', p.cmd,
          'qual', p.qual,
          'with_check', p.with_check
        ))
        FROM policies p
        WHERE p.table = t.table
      ), '[]'::json)
    ))
    FROM tables t
  )
)::text;
SQL
