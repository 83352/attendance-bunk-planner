-- Make configuration saves safe across sections and duplicate exam names.
-- Run after migrations 001 through 010.

create table if not exists public.universal_calendar_version (
  id boolean primary key default true check (id),
  updated_at timestamptz not null default now()
);

insert into public.universal_calendar_version (id)
values (true)
on conflict (id) do nothing;

alter function public.is_admin() set search_path = pg_catalog, public;

alter table public.universal_calendar_version enable row level security;
drop policy if exists "Admins can read universal calendar version" on public.universal_calendar_version;
create policy "Admins can read universal calendar version"
  on public.universal_calendar_version for select
  to authenticated
  using ((select public.is_admin()));

alter table public.exam_period_days add column if not exists exam_id uuid references public.exam_periods(id) on delete cascade;

update public.exam_period_days day_row
set exam_id = exam.id
from public.exam_periods exam
where day_row.exam_id is null
  and day_row.semester_id = exam.semester_id
  and day_row.exam_name = exam.name;

alter table public.exam_period_days alter column exam_id set not null;
alter table public.exam_period_days drop constraint if exists exam_period_days_semester_id_exam_name_date_key;
alter table public.exam_period_days drop column if exists exam_name;
alter table public.exam_period_days add constraint exam_period_days_exam_id_date_key unique (exam_id, date);

alter table public.exam_periods drop constraint if exists exam_periods_semester_id_name_key;

-- The previous overloads must not remain callable after the new section-id
-- based function is installed.
drop function if exists public.save_semester_config(text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_semester_config(text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz);

create or replace function public.save_semester_config(
  p_section_id uuid,
  p_section_name text,
  p_semester_start date,
  p_semester_end date,
  p_timetable jsonb,
  p_exams jsonb,
  p_exam_days jsonb,
  p_holidays jsonb,
  p_special_saturdays jsonb,
  p_expected_updated_at timestamptz default null,
  p_expected_calendar_updated_at timestamptz default null
) returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_section_id uuid;
  v_semester_id uuid;
  v_existing_updated_at timestamptz;
  v_calendar_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'save_semester_config requires an administrator' using errcode = '42501';
  end if;
  if coalesce(btrim(p_section_name), '') = '' then
    raise exception 'Section name is required' using errcode = '22023';
  end if;

  select updated_at into v_calendar_updated_at
  from public.universal_calendar_version
  where id = true
  for update;
  if p_expected_calendar_updated_at is not null
     and v_calendar_updated_at is distinct from p_expected_calendar_updated_at then
    raise exception 'The shared calendar was changed by someone else after you loaded it. Reload and try again.'
      using errcode = '40001';
  end if;

  if p_section_id is null then
    insert into public.sections (name) values (btrim(p_section_name)) returning id into v_section_id;
  else
    select id into v_section_id from public.sections where id = p_section_id for update;
    if v_section_id is null then
      raise exception 'The selected section no longer exists. Reload and try again.' using errcode = 'P0001';
    end if;
    update public.sections set name = btrim(p_section_name) where id = v_section_id;
  end if;

  select id, updated_at into v_semester_id, v_existing_updated_at
  from public.semesters
  where section_id = v_section_id and name = 'Current semester'
  for update;

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
  returning id, updated_at into v_semester_id, v_existing_updated_at;

  delete from public.timetable_periods where semester_id = v_semester_id;
  delete from public.exam_periods where semester_id = v_semester_id;

  insert into public.timetable_periods (semester_id, weekday, sequence, start_time, end_time)
  select v_semester_id, (period->>'weekday')::smallint, (period->>'sequence')::smallint,
    (period->>'start')::time, (period->>'end')::time
  from jsonb_array_elements(p_timetable) period;

  insert into public.exam_periods (id, semester_id, name, start_date, end_date, periods_per_day)
  select coalesce(nullif(exam->>'id', '')::uuid, gen_random_uuid()), v_semester_id,
    exam->>'name', (exam->>'start')::date, (exam->>'end')::date,
    (exam->>'periodsPerDay')::smallint
  from jsonb_array_elements(p_exams) exam;

  insert into public.exam_period_days (semester_id, exam_id, date, periods_per_day)
  select v_semester_id, (day->>'examId')::uuid, (day->>'date')::date,
    (day->>'periodsPerDay')::smallint
  from jsonb_array_elements(p_exam_days) day;

  delete from public.universal_holidays;
  insert into public.universal_holidays (name, start_date, end_date)
  select holiday->>'name', (holiday->>'start')::date, (holiday->>'end')::date
  from jsonb_array_elements(p_holidays) holiday;

  delete from public.universal_special_saturdays;
  insert into public.universal_special_saturdays (date, copied_weekday)
  select (special->>'date')::date, (special->>'copiedWeekday')::smallint
  from jsonb_array_elements(p_special_saturdays) special;

  update public.universal_calendar_version set updated_at = now() where id = true;
  return v_existing_updated_at;
end;
$$;

revoke execute on function public.save_semester_config(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.save_semester_config(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz) to authenticated;
