-- Performance hardening for RLS policies (addresses database linter warnings).
--
-- 1. auth_rls_initplan: the admin_profiles read policy called auth.uid()
--    directly, which Postgres re-evaluates for every row. Wrapping it in a
--    scalar subquery lets the planner evaluate it once per statement.
--
-- 2. multiple_permissive_policies: every public table had a "Public can read"
--    (FOR SELECT) policy AND an "Admins can modify" (FOR ALL) policy. FOR ALL
--    includes SELECT, so two permissive SELECT policies ran on every read.
--    Since the public policy already grants SELECT to everyone (including
--    admins), the admin policies only need to cover writes. We replace each
--    FOR ALL policy with explicit INSERT/UPDATE/DELETE policies.
--
-- is_admin() is wrapped in a subselect as well for the same initplan reason.
-- Authorization semantics are unchanged: admins can still write, everyone can
-- still read.

-- admin_profiles: single SELECT policy, just fix the initplan re-evaluation.
drop policy if exists "Admins can read profiles" on public.admin_profiles;
create policy "Admins can read profiles" on public.admin_profiles
  for select using ((select auth.uid()) = user_id);

-- sections
drop policy if exists "Admins can modify sections" on public.sections;
create policy "Admins can insert sections" on public.sections
  for insert with check ((select public.is_admin()));
create policy "Admins can update sections" on public.sections
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete sections" on public.sections
  for delete using ((select public.is_admin()));

-- semesters
drop policy if exists "Admins can modify semesters" on public.semesters;
create policy "Admins can insert semesters" on public.semesters
  for insert with check ((select public.is_admin()));
create policy "Admins can update semesters" on public.semesters
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete semesters" on public.semesters
  for delete using ((select public.is_admin()));

-- timetable_periods
drop policy if exists "Admins can modify timetable" on public.timetable_periods;
create policy "Admins can insert timetable" on public.timetable_periods
  for insert with check ((select public.is_admin()));
create policy "Admins can update timetable" on public.timetable_periods
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete timetable" on public.timetable_periods
  for delete using ((select public.is_admin()));

-- exam_periods
drop policy if exists "Admins can modify exams" on public.exam_periods;
create policy "Admins can insert exams" on public.exam_periods
  for insert with check ((select public.is_admin()));
create policy "Admins can update exams" on public.exam_periods
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete exams" on public.exam_periods
  for delete using ((select public.is_admin()));

-- exam_period_days
drop policy if exists "Admins can modify exam day overrides" on public.exam_period_days;
create policy "Admins can insert exam day overrides" on public.exam_period_days
  for insert with check ((select public.is_admin()));
create policy "Admins can update exam day overrides" on public.exam_period_days
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete exam day overrides" on public.exam_period_days
  for delete using ((select public.is_admin()));

-- universal_holidays
drop policy if exists "Admins can modify universal holidays" on public.universal_holidays;
create policy "Admins can insert universal holidays" on public.universal_holidays
  for insert with check ((select public.is_admin()));
create policy "Admins can update universal holidays" on public.universal_holidays
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete universal holidays" on public.universal_holidays
  for delete using ((select public.is_admin()));

-- universal_special_saturdays
drop policy if exists "Admins can modify universal special Saturdays" on public.universal_special_saturdays;
create policy "Admins can insert universal special Saturdays" on public.universal_special_saturdays
  for insert with check ((select public.is_admin()));
create policy "Admins can update universal special Saturdays" on public.universal_special_saturdays
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete universal special Saturdays" on public.universal_special_saturdays
  for delete using ((select public.is_admin()));
