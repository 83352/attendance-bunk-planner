-- Regression test for the sharpest edge in migration 017_academic_years.sql:
-- save_semester_config replaces the calendar wholesale, so if any of its
-- delete/insert statements loses its `year` filter, saving a 3rd-year section
-- silently destroys 2nd year's holidays. Nothing surfaces an error; students
-- just start getting wrong attendance maths.
--
-- Run against a throwaway Postgres that has every migration applied
-- (supabase/rehearse.sh leaves one in exactly that state):
--   psql -v ON_ERROR_STOP=1 -f supabase/test_year_isolation.sql
--
-- This file mutates data, so never point it at a real database.

begin;

-- save_semester_config is admin-gated and there is no auth stack here.
-- Local to this transaction; rolled back at the end.
create or replace function public.is_admin() returns boolean
language sql stable as $$ select true $$;

-- ---------------------------------------------------------------------------
-- Fixture: one section per year, each with its own calendar.
-- ---------------------------------------------------------------------------

insert into public.sections (id, name, year, is_ready) values
  ('11111111-1111-1111-1111-111111111111', 'ISO TEST', 2, true),
  ('22222222-2222-2222-2222-222222222222', 'ISO TEST', 3, false);

insert into public.semesters (section_id, name, start_date, end_date) values
  ('11111111-1111-1111-1111-111111111111', 'Current semester', '2026-08-01', '2026-12-31'),
  ('22222222-2222-2222-2222-222222222222', 'Current semester', '2026-08-01', '2026-12-31');

delete from public.universal_holidays where year in (2, 3);
delete from public.universal_special_saturdays where year in (2, 3);

insert into public.universal_holidays (name, start_date, end_date, year) values
  ('Second year Dasara', '2026-10-12', '2026-10-18', 2),
  ('Second year Diwali', '2026-11-08', '2026-11-10', 2),
  ('Third year Dasara',  '2026-10-12', '2026-10-18', 3);

-- 2026-09-05 and 2026-09-12 are Saturdays (the table checks this).
insert into public.universal_special_saturdays (date, copied_weekday, year) values
  ('2026-09-05', 1, 2),
  ('2026-09-12', 2, 3);

insert into public.universal_calendar_version (year) values (2), (3)
  on conflict (year) do nothing;
update public.universal_calendar_version set updated_at = '2020-01-01T00:00:00Z' where year in (2, 3);

-- ---------------------------------------------------------------------------
-- Act: save the THIRD-year section with a completely different calendar.
-- ---------------------------------------------------------------------------

select public.save_semester_config(
  p_section_id => '22222222-2222-2222-2222-222222222222',
  p_section_name => 'ISO TEST',
  p_semester_start => '2026-08-01',
  p_semester_end => '2026-12-31',
  p_timetable => '[]'::jsonb,
  p_exams => '[]'::jsonb,
  p_exam_days => '[]'::jsonb,
  p_holidays => '[{"name":"Third year replaced","start":"2026-12-01","end":"2026-12-05"}]'::jsonb,
  p_special_saturdays => '[{"date":"2026-09-19","copiedWeekday":3}]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Assert
-- ---------------------------------------------------------------------------

do $$
declare
  v_count int;
  v_name text;
  v_ver2 timestamptz;
  v_ver3 timestamptz;
begin
  -- 1. Second year's holidays must be exactly as they were.
  select count(*) into v_count from public.universal_holidays where year = 2;
  if v_count <> 2 then
    raise exception 'FAIL: 2nd-year holidays were clobbered by a 3rd-year save (expected 2 rows, found %)', v_count;
  end if;
  if not exists (select 1 from public.universal_holidays where year = 2 and name = 'Second year Dasara')
     or not exists (select 1 from public.universal_holidays where year = 2 and name = 'Second year Diwali') then
    raise exception 'FAIL: 2nd-year holiday rows changed identity after a 3rd-year save';
  end if;

  -- 2. Second year's special Saturdays must be untouched.
  select count(*) into v_count from public.universal_special_saturdays where year = 2;
  if v_count <> 1 then
    raise exception 'FAIL: 2nd-year special Saturdays were clobbered (expected 1 row, found %)', v_count;
  end if;
  if not exists (select 1 from public.universal_special_saturdays where year = 2 and date = '2026-09-05') then
    raise exception 'FAIL: the 2nd-year special Saturday was replaced by the 3rd-year one';
  end if;

  -- 3. Third year's calendar must actually have been replaced.
  select count(*) into v_count from public.universal_holidays where year = 3;
  if v_count <> 1 then
    raise exception 'FAIL: 3rd-year holidays not replaced (expected 1 row, found %)', v_count;
  end if;
  select name into v_name from public.universal_holidays where year = 3;
  if v_name <> 'Third year replaced' then
    raise exception 'FAIL: 3rd-year holiday is "%", expected "Third year replaced"', v_name;
  end if;
  if not exists (select 1 from public.universal_special_saturdays where year = 3 and date = '2026-09-19') then
    raise exception 'FAIL: 3rd-year special Saturday not replaced';
  end if;

  -- 4. Only the saved year's optimistic lock may advance, or the two years
  --    keep rejecting each other's saves.
  select updated_at into v_ver2 from public.universal_calendar_version where year = 2;
  select updated_at into v_ver3 from public.universal_calendar_version where year = 3;
  if v_ver2 <> '2020-01-01T00:00:00Z' then
    raise exception 'FAIL: a 3rd-year save bumped the 2nd-year calendar version';
  end if;
  if v_ver3 = '2020-01-01T00:00:00Z' then
    raise exception 'FAIL: the 3rd-year calendar version did not advance on save';
  end if;

  raise notice 'PASS: calendar isolation holds across years';
end $$;

-- ---------------------------------------------------------------------------
-- A section must not be able to change year through a save, which would
-- silently retarget which year's calendar the save rewrites.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.save_semester_config(
      p_section_id => '22222222-2222-2222-2222-222222222222',
      p_section_name => 'ISO TEST',
      p_semester_start => '2026-08-01',
      p_semester_end => '2026-12-31',
      p_timetable => '[]'::jsonb,
      p_exams => '[]'::jsonb,
      p_exam_days => '[]'::jsonb,
      p_holidays => '[]'::jsonb,
      p_special_saturdays => '[]'::jsonb,
      p_year => 2::smallint
    );
    raise exception 'FAIL: a save was allowed to move a section between years';
  exception
    when sqlstate '22023' then
      raise notice 'PASS: cross-year save rejected';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Both years must be able to hold a section of the same name.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into public.sections (name, year) values ('ISO TEST', 2);
    raise exception 'FAIL: duplicate (year, name) was accepted';
  exception
    when unique_violation then
      raise notice 'PASS: (year, name) uniqueness enforced';
  end;
end $$;

rollback;
