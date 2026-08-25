import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultConfig } from '@/lib/default-config';
import type { ScheduleConfig } from '@/domain/schedule/types';

export type LoadedSectionConfig = {
  config: ScheduleConfig;
  /** Timestamp of the last save for this semester; used for optimistic locking. Null when nothing is saved yet. */
  updatedAt: string | null;
};

/**
 * Loads one section's saved schedule from Supabase and maps raw rows to the
 * app's ScheduleConfig shape. Shared by the public calculator and the admin
 * editor so both always agree on how rows become config.
 *
 * Returns defaultConfig when the section has no saved semester yet — callers
 * decide what to render.
 */
export async function loadSectionConfig(supabase: SupabaseClient, sectionId: string): Promise<LoadedSectionConfig> {
  const { data: semester } = await supabase
    .from('semesters')
    .select('id, start_date, end_date, updated_at')
    .eq('section_id', sectionId)
    .eq('name', 'Current semester')
    .single();
  if (!semester) return { config: defaultConfig, updatedAt: null };

  const [{ data: timetable }, { data: holidays }, { data: specialSaturdays }, { data: exams }, { data: examDays }] = await Promise.all([
    supabase.from('timetable_periods').select('weekday, sequence, start_time, end_time').eq('semester_id', semester.id).order('weekday').order('sequence'),
    supabase.from('universal_holidays').select('name, start_date, end_date').order('start_date'),
    supabase.from('universal_special_saturdays').select('date, copied_weekday').order('date'),
    supabase.from('exam_periods').select('name, start_date, end_date, periods_per_day').eq('semester_id', semester.id),
    supabase.from('exam_period_days').select('exam_name, date, periods_per_day').eq('semester_id', semester.id),
  ]);

  const config: ScheduleConfig = {
    semesterStart: semester.start_date,
    semesterEnd: semester.end_date,
    timetable: (timetable ?? []).map((period) => ({ weekday: period.weekday, sequence: period.sequence, start: String(period.start_time).slice(0, 5), end: String(period.end_time).slice(0, 5) })),
    holidays: (holidays ?? []).map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })),
    specialSaturdays: (specialSaturdays ?? []).map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday })),
    exams: (exams ?? []).map((exam) => ({
      name: exam.name,
      start: exam.start_date,
      end: exam.end_date,
      periodsPerDay: exam.periods_per_day,
      dailyPeriods: (examDays ?? []).filter((day) => day.exam_name === exam.name).map((day) => ({ date: day.date, periodsPerDay: day.periods_per_day })),
    })),
  };

  return { config, updatedAt: semester.updated_at ?? null };
}
