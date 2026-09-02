-- Keep section deletion and first-section creation behind explicit RPCs.
-- Run after migration 012_integrity_and_write_path.sql.

create or replace function public.delete_section(p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then
    raise exception 'delete_section requires an administrator' using errcode = '42501';
  end if;
  delete from public.sections where id = p_section_id;
  if not found then
    raise exception 'The selected section no longer exists.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.delete_section(uuid) from public, anon;
grant execute on function public.delete_section(uuid) to authenticated;

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
  p_expected_calendar_updated_at timestamptz default null
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
    p_expected_calendar_updated_at
  );
  if p_section_id is not null then
    return p_section_id;
  end if;
  select id into v_section_id from public.sections where name = btrim(p_section_name);
  return v_section_id;
end;
$$;

revoke execute on function public.save_semester_config_with_id(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.save_semester_config_with_id(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz) to authenticated;
