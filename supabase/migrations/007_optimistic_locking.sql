-- Optimistic locking for schedule saves.
--
-- Two admins (or two tabs) can load the editor at the same time. Without this
-- migration, the second save silently overwrites the first. From now on every
-- save must present the updated_at timestamp it loaded; if another save
-- happened in between, Postgres rejects the write and the editor tells the
-- user to reload.
--
-- The application passes NULL when it did not load a saved semester (first
-- save for a brand-new section), which skips the check.

alter table public.semesters add column if not exists updated_at timestamptz not null default now();

create or replace function public.save_semester_config(
  p_section_name text,
  p_semester_start date,
  p_semester_end date,
  p_timetable jsonb,
  p_exams jsonb,
  p_exam_days jsonb,
  p_holidays jsonb,
  p_special_saturdays jsonb,
  p_expected_updated_at timestamptz default null
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section_id uuid;
  v_semester_id uuid;
  v_existing_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'save_semester_config requires an administrator' using errcode = '42501';
  end if;

  if coalesce(p_section_name, '') = '' then
    raise exception 'Section name is required' using errcode = '22023';
  end if;

  -- Resolve (or create) the section by name. Upsert on name mirrors the
  -- previous behaviour where saving under a new name copies the config.
  insert into public.sections (name)
  values (p_section_name)
  on conflict (name) do update set name = excluded.name
  returning id into v_section_id;

  select id, updated_at into v_semester_id, v_existing_updated_at
  from public.semesters
  where section_id = v_section_id and name = 'Current semester';

  if v_semester_id is not null
     and p_expected_updated_at is not null
     and v_existing_updated_at is distinct from p_expected_updated_at then
    raise exception 'The configuration was changed by someone else after you loaded it. Reload and try again.'
      using errcode = '40001';
  end if;

  insert into public.semesters (section_id, name, start_date, end_date)
  values (v_section_id, 'Current semester', p_semester_start, p_semester_end)
  on conflict (section_id, name) do update
    set start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = now()
  returning semesters.updated_at into v_existing_updated_at;

  -- Section-specific data -------------------------------------------------

  delete from public.timetable_periods where semester_id = v_semester_id;
  delete from public.exam_periods where semester_id = v_semester_id;
  delete from public.exam_period_days where semester_id = v_semester_id;

  insert into public.timetable_periods (semester_id, weekday, sequence, start_time, end_time)
  select
    v_semester_id,
    (period->>'weekday')::smallint,
    (period->>'sequence')::smallint,
    (period->>'start')::time,
    (period->>'end')::time
  from jsonb_array_elements(p_timetable) as period;

  insert into public.exam_periods (semester_id, name, start_date, end_date, periods_per_day)
  select
    v_semester_id,
    exam->>'name',
    (exam->>'start')::date,
    (exam->>'end')::date,
    (exam->>'periodsPerDay')::smallint
  from jsonb_array_elements(p_exams) as exam;

  insert into public.exam_period_days (semester_id, exam_name, date, periods_per_day)
  select
    v_semester_id,
    day->>'examName',
    (day->>'date')::date,
    (day->>'periodsPerDay')::smallint
  from jsonb_array_elements(p_exam_days) as day;

  -- Universal data --------------------------------------------------------

  delete from public.universal_holidays where true;
  insert into public.universal_holidays (name, start_date, end_date)
  select
    holiday->>'name',
    (holiday->>'start')::date,
    (holiday->>'end')::date
  from jsonb_array_elements(p_holidays) as holiday;

  delete from public.universal_special_saturdays where true;
  insert into public.universal_special_saturdays (date, copied_weekday)
  select
    (special->>'date')::date,
    (special->>'copiedWeekday')::smallint
  from jsonb_array_elements(p_special_saturdays) as special;

  return v_existing_updated_at;
end;
$$;

drop function if exists public.save_semester_config(text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb);

revoke execute on function public.save_semester_config(text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz) from public;
revoke execute on function public.save_semester_config(text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz) from anon;
grant execute on function public.save_semester_config(text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz) to authenticated;
