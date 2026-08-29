-- Allow custom exam names.
--
-- exam_periods.name and exam_period_days.exam_name used to be check-constrained
-- to ('Mid 1', 'Mid 2'), which made it impossible to add a one-off exam day
-- (for example a Saturday makeup test) without first writing new server code.
-- The save_semester_config RPC already passes the name through as plain text,
-- so the only thing holding the system back was these two CHECK constraints.
--
-- We replace them with a single trimmed-non-empty constraint per column so
-- blanks cannot sneak in but admins can use any reasonable name they want.
-- The existing (semester_id, name) unique index on exam_periods still applies,
-- so a uniqueness refine is added on the application side to give a clearer
-- error message before the database rejects the row.

alter table public.exam_periods
  drop constraint if exists exam_periods_name_check;
alter table public.exam_period_days
  drop constraint if exists exam_period_days_exam_name_check;

alter table public.exam_periods
  add constraint exam_periods_name_nonblank_check
  check (length(btrim(name)) > 0);
alter table public.exam_period_days
  add constraint exam_period_days_exam_name_nonblank_check
  check (length(btrim(exam_name)) > 0);
