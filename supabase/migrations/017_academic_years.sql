-- Introduce academic years so the app can serve more than one year at a time.
-- Run after migration 016_fix_unfiltered_calendar_deletes.sql.
--
-- Until now every row in this database implicitly belonged to 2nd year:
-- sections.name was globally unique, and universal_holidays /
-- universal_special_saturdays were a single college-wide calendar applied to
-- every section. Both assumptions break the moment a second year exists,
-- because 3rd year has its own "CSE 1" and its own holiday list.
--
-- Three things change here:
--   1. sections gains `year`, and uniqueness moves from (name) to (year, name).
--   2. The two universal calendar tables gain `year`, so each year owns its
--      own holidays and special Saturdays.
--   3. save_semester_config's replace-all calendar deletes become year-scoped.
--      This is the dangerous part. Those deletes wipe the calendar and rewrite
--      it from the payload; unscoped, saving any 3rd-year section would delete
--      2nd year's holidays and silently inflate every 2nd-year student's
--      attendance maths. Migration 016 exists because these same deletes were
--      once unfiltered -- splitting the table by year reopens that trapdoor one
--      level deeper, so every statement below names its year explicitly.
--
-- `year` is checked 1..4 rather than just (2,3): a college has four years, and
-- a permissive guard here avoids another constraint migration when 4th year
-- arrives. Only the RPCs below can write these tables (see migration 015), and
-- the admin UI offers 2 and 3, so the wider range is a guard, not an invitation.

-- ---------------------------------------------------------------------------
-- 1. sections
-- ---------------------------------------------------------------------------

alter table public.sections
  add column if not exists year smallint not null default 2;

alter table public.sections
  drop constraint if exists sections_year_check;
alter table public.sections
  add constraint sections_year_check check (year between 1 and 4);

-- Existing rows are all 2nd year (the default above backfilled them). Drop the
-- default so every future insert has to state its year: a section that lands in
-- the wrong year is invisible to the students who need it, and silently
-- defaulting would hide that.
alter table public.sections
  alter column year drop default;

-- `is_ready` gates public visibility. 3rd-year sections are seeded below by
-- copying 2nd year, so until an admin corrects each timetable they hold
-- confidently wrong data -- a student would get a plausible, precise, incorrect
-- bunk count with nothing on screen to suggest a problem. Existing rows are
-- live and correct, so they take `true` from the add-column default; the
-- default then flips to false so anything created from here on is opt-in.
alter table public.sections
  add column if not exists is_ready boolean not null default true;
alter table public.sections
  alter column is_ready set default false;

-- Uniqueness moves to (year, name) so both years can have a "CSE 1".
alter table public.sections
  drop constraint if exists sections_name_key;
alter table public.sections
  drop constraint if exists sections_year_name_key;
alter table public.sections
  add constraint sections_year_name_key unique (year, name);

-- ---------------------------------------------------------------------------
-- 2. Per-year calendars
-- ---------------------------------------------------------------------------

alter table public.universal_holidays
  add column if not exists year smallint not null default 2;
alter table public.universal_holidays
  drop constraint if exists universal_holidays_year_check;
alter table public.universal_holidays
  add constraint universal_holidays_year_check check (year between 1 and 4);
alter table public.universal_holidays
  alter column year drop default;

alter table public.universal_special_saturdays
  add column if not exists year smallint not null default 2;
alter table public.universal_special_saturdays
  drop constraint if exists universal_special_saturdays_year_check;
alter table public.universal_special_saturdays
  add constraint universal_special_saturdays_year_check check (year between 1 and 4);
alter table public.universal_special_saturdays
  alter column year drop default;

-- A given Saturday can be a working day for one year and not another, so the
-- unique key has to include the year or the second year's row is rejected.
alter table public.universal_special_saturdays
  drop constraint if exists universal_special_saturdays_date_key;
alter table public.universal_special_saturdays
  drop constraint if exists universal_special_saturdays_year_date_key;
alter table public.universal_special_saturdays
  add constraint universal_special_saturdays_year_date_key unique (year, date);

create index if not exists universal_holidays_year_idx
  on public.universal_holidays (year);
create index if not exists universal_special_saturdays_year_idx
  on public.universal_special_saturdays (year);
create index if not exists sections_year_idx
  on public.sections (year);

-- ---------------------------------------------------------------------------
-- 3. Per-year calendar version (optimistic lock)
-- ---------------------------------------------------------------------------
--
-- This was a singleton row (`id boolean primary key check (id)`) guarding one
-- calendar. With two calendars sharing it, an admin saving 2nd-year holidays
-- would bump the row and get a 3rd-year admin's unrelated save rejected. That
-- only ever refuses saves -- it cannot let a conflicting one through -- but a
-- lock that cries wolf is a lock people learn to click past, so it becomes one
-- row per year.

alter table public.universal_calendar_version
  add column if not exists year smallint;
update public.universal_calendar_version set year = 2 where year is null;

alter table public.universal_calendar_version
  drop constraint if exists universal_calendar_version_pkey;
alter table public.universal_calendar_version
  drop column if exists id;
alter table public.universal_calendar_version
  alter column year set not null;
alter table public.universal_calendar_version
  add constraint universal_calendar_version_pkey primary key (year);
alter table public.universal_calendar_version
  drop constraint if exists universal_calendar_version_year_check;
alter table public.universal_calendar_version
  add constraint universal_calendar_version_year_check check (year between 1 and 4);

insert into public.universal_calendar_version (year)
values (2), (3)
on conflict (year) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Write path
-- ---------------------------------------------------------------------------
--
-- The new p_year argument has a default, which would make the old 11-argument
-- signature ambiguous with the new one, so the old functions are dropped rather
-- than replaced. with_id first: it calls save_semester_config.

drop function if exists public.save_semester_config_with_id(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz);
drop function if exists public.save_semester_config(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz);

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
  p_expected_calendar_updated_at timestamptz default null,
  p_year smallint default null
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
  v_year smallint;
begin
  if not public.is_admin() then
    raise exception 'save_semester_config requires an administrator' using errcode = '42501';
  end if;
  if coalesce(btrim(p_section_name), '') = '' then
    raise exception 'Section name is required' using errcode = '22023';
  end if;

  -- Resolve the year before anything else: every calendar statement below is
  -- scoped by it, so it must never be null.
  if p_section_id is null then
    if p_year is null then
      raise exception 'A year is required when creating a section' using errcode = '22023';
    end if;
    v_year := p_year;
  else
    select year into v_year from public.sections where id = p_section_id;
    if v_year is null then
      raise exception 'The selected section no longer exists. Reload and try again.' using errcode = 'P0001';
    end if;
    -- A section cannot be moved between years by saving its schedule; that
    -- would silently retarget which calendar this save rewrites.
    if p_year is not null and p_year is distinct from v_year then
      raise exception 'A section cannot change year.' using errcode = '22023';
    end if;
  end if;

  select updated_at into v_calendar_updated_at
  from public.universal_calendar_version
  where year = v_year
  for update;
  if v_calendar_updated_at is null then
    insert into public.universal_calendar_version (year) values (v_year)
    on conflict (year) do nothing;
    select updated_at into v_calendar_updated_at
    from public.universal_calendar_version
    where year = v_year
    for update;
  end if;
  if p_expected_calendar_updated_at is not null
     and v_calendar_updated_at is distinct from p_expected_calendar_updated_at then
    raise exception 'The shared calendar was changed by someone else after you loaded it. Reload and try again.'
      using errcode = '40001';
  end if;

  if p_section_id is null then
    insert into public.sections (name, year) values (btrim(p_section_name), v_year) returning id into v_section_id;
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

  -- Year-scoped, deliberately. `where year = v_year` is the only thing standing
  -- between a 3rd-year save and 2nd year's holidays.
  delete from public.universal_holidays where year = v_year;
  insert into public.universal_holidays (name, start_date, end_date, year)
  select holiday->>'name', (holiday->>'start')::date, (holiday->>'end')::date, v_year
  from jsonb_array_elements(p_holidays) holiday;

  delete from public.universal_special_saturdays where year = v_year;
  insert into public.universal_special_saturdays (date, copied_weekday, year)
  select (special->>'date')::date, (special->>'copiedWeekday')::smallint, v_year
  from jsonb_array_elements(p_special_saturdays) special;

  update public.universal_calendar_version set updated_at = now() where year = v_year;
  return v_existing_updated_at;
end;
$$;

revoke execute on function public.save_semester_config(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz, smallint) from public, anon;
grant execute on function public.save_semester_config(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz, smallint) to authenticated;

create or replace function public.save_semester_config_with_id(
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
  p_expected_calendar_updated_at timestamptz default null,
  p_year smallint default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_section_id uuid;
begin
  perform public.save_semester_config(
    p_section_id,
    p_section_name,
    p_semester_start,
    p_semester_end,
    p_timetable,
    p_exams,
    p_exam_days,
    p_holidays,
    p_special_saturdays,
    p_expected_updated_at,
    p_expected_calendar_updated_at,
    p_year
  );
  if p_section_id is not null then
    return p_section_id;
  end if;
  -- Names are only unique within a year now, so this lookup has to name the
  -- year too or it can return the wrong year's section.
  select id into v_section_id
  from public.sections
  where name = btrim(p_section_name) and year = p_year;
  return v_section_id;
end;
$$;

revoke execute on function public.save_semester_config_with_id(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz, smallint) from public, anon;
grant execute on function public.save_semester_config_with_id(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Seed 3rd year from 2nd
-- ---------------------------------------------------------------------------
--
-- Every 3rd-year section starts as a copy of the 2nd-year section with the same
-- name, and is_ready defaults to false so none of it reaches students until an
-- admin has checked it. On a fresh database (CI's rehearse.sh) there is no
-- 2nd-year data, so all of this is a no-op.

insert into public.sections (name, year, is_ready)
select s.name, 3, false
from public.sections s
where s.year = 2
on conflict (year, name) do nothing;

insert into public.universal_holidays (name, start_date, end_date, year)
select h.name, h.start_date, h.end_date, 3
from public.universal_holidays h
where h.year = 2
  and not exists (select 1 from public.universal_holidays x where x.year = 3);

insert into public.universal_special_saturdays (date, copied_weekday, year)
select ss.date, ss.copied_weekday, 3
from public.universal_special_saturdays ss
where ss.year = 2
on conflict (year, date) do nothing;

insert into public.semesters (section_id, name, start_date, end_date)
select s3.id, sem2.name, sem2.start_date, sem2.end_date
from public.semesters sem2
join public.sections s2 on s2.id = sem2.section_id and s2.year = 2
join public.sections s3 on s3.name = s2.name and s3.year = 3
on conflict (section_id, name) do nothing;

insert into public.timetable_periods (semester_id, weekday, sequence, start_time, end_time)
select sem3.id, tp.weekday, tp.sequence, tp.start_time, tp.end_time
from public.timetable_periods tp
join public.semesters sem2 on sem2.id = tp.semester_id
join public.sections s2 on s2.id = sem2.section_id and s2.year = 2
join public.sections s3 on s3.name = s2.name and s3.year = 3
join public.semesters sem3 on sem3.section_id = s3.id and sem3.name = sem2.name
where not exists (select 1 from public.timetable_periods x where x.semester_id = sem3.id);

-- Exams need their new ids mapped onto the copied exam-day overrides.
-- (semester_id, name) is unique on exam_periods, so the freshly inserted rows
-- can be joined back by that pair.
with pairs as (
  select sem2.id as sem2_id, sem3.id as sem3_id
  from public.semesters sem2
  join public.sections s2 on s2.id = sem2.section_id and s2.year = 2
  join public.sections s3 on s3.name = s2.name and s3.year = 3
  join public.semesters sem3 on sem3.section_id = s3.id and sem3.name = sem2.name
  where not exists (select 1 from public.exam_periods x where x.semester_id = sem3.id)
),
inserted as (
  insert into public.exam_periods (semester_id, name, start_date, end_date, periods_per_day)
  select p.sem3_id, e.name, e.start_date, e.end_date, e.periods_per_day
  from pairs p
  join public.exam_periods e on e.semester_id = p.sem2_id
  returning id, semester_id, name
)
insert into public.exam_period_days (semester_id, exam_id, date, periods_per_day)
select i.semester_id, i.id, d.date, d.periods_per_day
from pairs p
join public.exam_periods e2 on e2.semester_id = p.sem2_id
join public.exam_period_days d on d.exam_id = e2.id
join inserted i on i.semester_id = p.sem3_id and i.name = e2.name;

-- ---------------------------------------------------------------------------
-- 6. Publishing a section
-- ---------------------------------------------------------------------------
--
-- Migration 015 removed every direct write policy on public.sections, so
-- flipping is_ready needs its own RPC rather than a REST update. Kept separate
-- from save_semester_config on purpose: publishing is a deliberate act, not
-- something that should ride along with an ordinary schedule save.

create or replace function public.set_section_ready(p_section_id uuid, p_is_ready boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then
    raise exception 'set_section_ready requires an administrator' using errcode = '42501';
  end if;
  update public.sections set is_ready = p_is_ready where id = p_section_id;
  if not found then
    raise exception 'The selected section no longer exists.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.set_section_ready(uuid, boolean) from public, anon;
grant execute on function public.set_section_ready(uuid, boolean) to authenticated;
