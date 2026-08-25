#!/usr/bin/env bash
# Migration rehearsal: apply every migration, in order, to a fresh Postgres
# and fail loudly if any statement or expected object is missing.
#
# Required environment variables:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE  (standard libpq vars)
set -euo pipefail

export PGSSLMODE="${PGSSLMODE:-disable}"

echo "Rehearsing migrations against ${PGHOST}:${PGPORT}/${PGDATABASE}"

# Supabase migrations reference auth.uid() from the auth schema. Real Supabase
# provides it; a plain Postgres container does not, so create a minimal stub.
psql -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
SQL

shopt -s nullglob
migrations=(/migrations/*.sql)
if [ "${#migrations[@]}" -eq 0 ]; then
  echo "No migrations found in /migrations" >&2
  exit 1
fi

for file in "${migrations[@]}"; do
  echo "== Applying $(basename "$file")"
  psql -v ON_ERROR_STOP=1 -f "$file"
done

echo "== Verifying schema objects"
psql -v ON_ERROR_STOP=1 --set=check=1 <<'SQL'
do $$
declare
  missing text;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sections') then
    missing := coalesce(missing || ', ', '') || 'table sections';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'semesters') then
    missing := coalesce(missing || ', ', '') || 'table semesters';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'semesters' and column_name = 'updated_at') then
    missing := coalesce(missing || ', ', '') || 'column semesters.updated_at';
  end if;
  if not exists (select 1 from information_schema.routines where routine_schema = 'public' and routine_name = 'save_semester_config') then
    missing := coalesce(missing || ', ', '') || 'function save_semester_config';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid') then
    missing := coalesce(missing || ', ', '') || 'function auth.uid';
  end if;
  if missing is not null then
    raise exception 'Rehearsal failed, missing: %', missing;
  end if;
end $$;
SQL

echo "All migrations applied cleanly."
