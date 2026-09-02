import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultConfig } from '@/lib/default-config';
import type { ScheduleConfig, Weekday } from '@/domain/schedule/types';

export type LoadedSectionConfig = {
  config: ScheduleConfig;
  /** Timestamp of the last save for this semester; used for optimistic locking. Null when nothing is saved yet. */
  updatedAt: string | null;
};

type UniversalCalendar = {
  holidays: { name: string; start_date: string; end_date: string }[];
  specialSaturdays: { date: string; copied_weekday: number }[];
};

function throwIfQueryFailed(error: { code?: string; message?: string } | null, fallbackMessage: string): void {
  if (error) {
    console.error(fallbackMessage, error);
    throw new Error(fallbackMessage);
  }
}

async function loadUniversalCalendar(supabase: SupabaseClient): Promise<UniversalCalendar> {
  const [holidaysResult, specialSaturdaysResult] = await Promise.all([
    supabase.from('universal_holidays').select('name, start_date, end_date').order('start_date'),
    supabase.from('universal_special_saturdays').select('date, copied_weekday').order('date'),
  ]);
  throwIfQueryFailed(holidaysResult.error, 'Unable to load holidays.');
  throwIfQueryFailed(specialSaturdaysResult.error, 'Unable to load special Saturdays.');
  return { holidays: holidaysResult.data ?? [], specialSaturdays: specialSaturdaysResult.data ?? [] };
}

/**
 * Loads one section's saved schedule from Supabase and maps raw rows to the
 * app's ScheduleConfig shape. Shared by the public calculator and the admin
 * editor so both always agree on how rows become config.
 *
 * Returns defaultConfig when the section has no saved semester yet — callers
 * decide what to render.
 */
export async function loadSectionConfig(supabase: SupabaseClient, sectionId: string, universalCalendar?: UniversalCalendar): Promise<LoadedSectionConfig> {
  const { data: semester, error: semesterError } = await supabase
    .from('semesters')
    .select('id, start_date, end_date, updated_at')
    .eq('section_id', sectionId)
    .eq('name', 'Current semester')
    .single();
  if (semesterError && semesterError.code !== 'PGRST116') throwIfQueryFailed(semesterError, 'Unable to load the semester configuration.');
  const shared = universalCalendar ?? await loadUniversalCalendar(supabase);
  if (!semester) return {
    config: { ...defaultConfig, holidays: shared.holidays.map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })), specialSaturdays: shared.specialSaturdays.map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday as Weekday })) },
    updatedAt: null,
  };

  const [timetableResult, examsResult, examDaysResult] = await Promise.all([
    supabase.from('timetable_periods').select('weekday, sequence, start_time, end_time').eq('semester_id', semester.id).order('weekday').order('sequence'),
    supabase.from('exam_periods').select('id, name, start_date, end_date, periods_per_day').eq('semester_id', semester.id),
    supabase.from('exam_period_days').select('exam_id, date, periods_per_day').eq('semester_id', semester.id),
  ]);
  throwIfQueryFailed(timetableResult.error, 'Unable to load the timetable.');
  throwIfQueryFailed(examsResult.error, 'Unable to load exams.');
  throwIfQueryFailed(examDaysResult.error, 'Unable to load exam-day overrides.');
  const { data: timetable } = timetableResult;
  const { data: exams } = examsResult;
  const { data: examDays } = examDaysResult;

  const config: ScheduleConfig = {
    semesterStart: semester.start_date,
    semesterEnd: semester.end_date,
    timetable: (timetable ?? []).map((period) => ({ weekday: period.weekday, sequence: period.sequence, start: String(period.start_time).slice(0, 5), end: String(period.end_time).slice(0, 5) })),
    holidays: shared.holidays.map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })),
    specialSaturdays: shared.specialSaturdays.map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday as Weekday })),
    exams: (exams ?? []).map((exam) => ({
      id: exam.id,
      name: exam.name,
      start: exam.start_date,
      end: exam.end_date,
      periodsPerDay: exam.periods_per_day,
      dailyPeriods: (examDays ?? []).filter((day) => day.exam_id === exam.id).map((day) => ({ date: day.date, periodsPerDay: day.periods_per_day })),
    })),
  };

  return { config, updatedAt: semester.updated_at ?? null };
}

/**
 * Loads the schedule config for every section in one parallel fan-out.
 * Used by the public home page so the user can switch sections without
 * hitting the network. Sections without a saved semester fall back to
 * defaultConfig so the client always has a complete config to render.
 */
export async function loadAllSectionConfigs(
  supabase: SupabaseClient,
  sections: { id: string; name: string }[],
): Promise<Record<string, ScheduleConfig>> {
  if (sections.length === 0) return {};
  const universalCalendar = await loadUniversalCalendar(supabase);
  const sectionIds = sections.map((section) => section.id);
  const { data: semesters, error: semestersError } = await supabase
    .from('semesters')
    .select('id, section_id, start_date, end_date, updated_at')
    .eq('name', 'Current semester')
    .in('section_id', sectionIds);
  throwIfQueryFailed(semestersError, 'Unable to load semester configurations.');

  const semesterRows = semesters ?? [];
  const semesterBySection = new Map(semesterRows.map((semester) => [semester.section_id, semester] as const));
  const semesterIds = semesterRows.map((semester) => semester.id);
  if (semesterIds.length === 0) {
    const fallback = { ...defaultConfig, holidays: universalCalendar.holidays.map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })), specialSaturdays: universalCalendar.specialSaturdays.map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday as Weekday })) };
    return Object.fromEntries(sections.map((section) => [section.id, fallback] as const));
  }

  const [timetableResult, examsResult, examDaysResult] = await Promise.all([
    supabase.from('timetable_periods').select('semester_id, weekday, sequence, start_time, end_time').in('semester_id', semesterIds).order('weekday').order('sequence'),
    supabase.from('exam_periods').select('id, semester_id, name, start_date, end_date, periods_per_day').in('semester_id', semesterIds),
    supabase.from('exam_period_days').select('exam_id, semester_id, date, periods_per_day').in('semester_id', semesterIds),
  ]);
  throwIfQueryFailed(timetableResult.error, 'Unable to load timetables.');
  throwIfQueryFailed(examsResult.error, 'Unable to load exams.');
  throwIfQueryFailed(examDaysResult.error, 'Unable to load exam-day overrides.');

  const timetableBySemester = new Map<string, typeof timetableResult.data>();
  for (const period of timetableResult.data ?? []) timetableBySemester.set(period.semester_id, [...(timetableBySemester.get(period.semester_id) ?? []), period]);
  const examsBySemester = new Map<string, typeof examsResult.data>();
  for (const exam of examsResult.data ?? []) examsBySemester.set(exam.semester_id, [...(examsBySemester.get(exam.semester_id) ?? []), exam]);
  const examDaysByExam = new Map<string, typeof examDaysResult.data>();
  for (const day of examDaysResult.data ?? []) examDaysByExam.set(day.exam_id, [...(examDaysByExam.get(day.exam_id) ?? []), day]);

  const entries = sections.map((section) => {
    const semester = semesterBySection.get(section.id);
    if (!semester) {
      return [section.id, { ...defaultConfig, holidays: universalCalendar.holidays.map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })), specialSaturdays: universalCalendar.specialSaturdays.map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday as Weekday })) }] as const;
    }
    const exams = examsBySemester.get(semester.id) ?? [];
    return [section.id, {
      semesterStart: semester.start_date,
      semesterEnd: semester.end_date,
      timetable: (timetableBySemester.get(semester.id) ?? []).map((period) => ({ weekday: period.weekday, sequence: period.sequence, start: String(period.start_time).slice(0, 5), end: String(period.end_time).slice(0, 5) })),
      holidays: universalCalendar.holidays.map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })),
      specialSaturdays: universalCalendar.specialSaturdays.map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday as Weekday })),
      exams: exams.map((exam) => ({ id: exam.id, name: exam.name, start: exam.start_date, end: exam.end_date, periodsPerDay: exam.periods_per_day, dailyPeriods: (examDaysByExam.get(exam.id) ?? []).map((day) => ({ date: day.date, periodsPerDay: day.periods_per_day })) })),
    }] as const;
  });
  return Object.fromEntries(entries);
}
