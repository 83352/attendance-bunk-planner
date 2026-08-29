-- Make optimistic-lock comparison millisecond-precise.
--
-- semesters.updated_at is stored with microsecond precision, but the lock
-- token travels to the browser and back as JSON and through JavaScript Date
-- values, which only keep milliseconds. The previous exact `is distinct from`
-- check therefore rejected every save: the client echoed back
-- `...30.086` while the row held `...30.086286`.
--
-- Comparing both sides truncated to milliseconds keeps the concurrency
-- guarantee (two saves in the same millisecond are not a realistic admin
-- scenario) while tolerating the client's precision. The function also now
-- returns the truncated timestamp so the value it hands back matches what a
-- subsequent load will compare against.

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

  insert into public.sections (name)
  values (p_section_name)
  on conflict (name) do update set name = excluded.name
  returning id into v_section_id;

  select id, updated_at into v_semester_id, v_existing_updated_at
  from public.semesters
  where section_id = v_section_id and name = 'Current semester';

  if v_semester_id is not null
     and p_expected_updated_at is not null
     and date_trunc('milliseconds', v_existing_updated_at)
         is distinct from date_trunc('milliseconds', p_expected_updated_at) then
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

  return date_trunc('milliseconds', v_existing_updated_at);
end;
$$;
