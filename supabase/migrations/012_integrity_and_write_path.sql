-- Enforce cross-semester exam integrity and keep configuration writes in the RPC.
-- Run after migration 011_safe_configuration_save.sql.

create unique index if not exists exam_periods_id_semester_id_key
  on public.exam_periods (id, semester_id);

create index if not exists exam_periods_semester_id_idx
  on public.exam_periods (semester_id);
create index if not exists exam_period_days_semester_id_idx
  on public.exam_period_days (semester_id);

alter table public.exam_period_days
  drop constraint if exists exam_period_days_exam_id_fkey;
alter table public.exam_period_days
  add constraint exam_period_days_exam_semester_fkey
  foreign key (exam_id, semester_id)
  references public.exam_periods (id, semester_id)
  on delete cascade;

-- The save RPC is SECURITY DEFINER and performs authorization plus version
-- checks before changing these tables. Direct writes would bypass those checks.
drop policy if exists "Admins can insert semesters" on public.semesters;
drop policy if exists "Admins can update semesters" on public.semesters;
drop policy if exists "Admins can delete semesters" on public.semesters;
drop policy if exists "Admins can insert timetable" on public.timetable_periods;
drop policy if exists "Admins can update timetable" on public.timetable_periods;
drop policy if exists "Admins can delete timetable" on public.timetable_periods;
drop policy if exists "Admins can insert exams" on public.exam_periods;
drop policy if exists "Admins can update exams" on public.exam_periods;
drop policy if exists "Admins can delete exams" on public.exam_periods;
drop policy if exists "Admins can insert exam day overrides" on public.exam_period_days;
drop policy if exists "Admins can update exam day overrides" on public.exam_period_days;
drop policy if exists "Admins can delete exam day overrides" on public.exam_period_days;
drop policy if exists "Admins can insert universal holidays" on public.universal_holidays;
drop policy if exists "Admins can update universal holidays" on public.universal_holidays;
drop policy if exists "Admins can delete universal holidays" on public.universal_holidays;
drop policy if exists "Admins can insert universal special Saturdays" on public.universal_special_saturdays;
drop policy if exists "Admins can update universal special Saturdays" on public.universal_special_saturdays;
drop policy if exists "Admins can delete universal special Saturdays" on public.universal_special_saturdays;
