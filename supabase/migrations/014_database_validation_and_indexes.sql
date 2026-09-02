-- Add database-side validation for invariants that must not depend on the UI.
-- Run after migration 013_admin_section_workflows.sql.

create or replace function public.validate_exam_day()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  exam_row public.exam_periods;
begin
  select * into exam_row
  from public.exam_periods
  where id = new.exam_id and semester_id = new.semester_id;
  if not found then
    raise exception 'Exam override must reference an exam in the same semester.' using errcode = '23514';
  end if;
  if new.date < exam_row.start_date or new.date > exam_row.end_date then
    raise exception 'Exam override date must be inside the exam range.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_exam_day_before_write on public.exam_period_days;
create trigger validate_exam_day_before_write
  before insert or update on public.exam_period_days
  for each row execute function public.validate_exam_day();

alter table public.universal_special_saturdays
  drop constraint if exists universal_special_saturdays_date_is_saturday;
alter table public.universal_special_saturdays
  add constraint universal_special_saturdays_date_is_saturday
  check (extract(dow from date) = 6);

create index if not exists timetable_periods_semester_id_idx
  on public.timetable_periods (semester_id);
