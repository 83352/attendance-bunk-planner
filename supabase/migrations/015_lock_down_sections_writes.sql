-- Close the last direct write path into public.sections.
--
-- Migration 012_integrity_and_write_path.sql revoked direct insert/update/
-- delete policies on every other write-path table so that all schedule
-- writes are forced through the audited save_semester_config /
-- save_semester_config_with_id / delete_section RPCs, which enforce admin
-- authorization, the optimistic lock, and the shared calendar-version check.
-- It missed public.sections itself, which still carried its original
-- per-statement admin policies from 008_rls_performance.sql. That let a
-- valid admin session write to `sections` directly via the REST API,
-- bypassing every check those RPCs perform.
--
-- The RPCs are SECURITY DEFINER, owned by a role that is not subject to RLS
-- on this table (confirmed: public.sections has relforcerowsecurity = false),
-- so dropping these policies does not change any existing admin
-- functionality -- it only removes the direct-write bypass. Public reads are
-- untouched.

drop policy if exists "Admins can insert sections" on public.sections;
drop policy if exists "Admins can update sections" on public.sections;
drop policy if exists "Admins can delete sections" on public.sections;
