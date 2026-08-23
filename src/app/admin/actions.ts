'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { semesterConfigSchema } from '@/lib/validation/config';

export type SaveConfigState = { error?: string; success?: string };

export async function saveSemesterConfig(_: SaveConfigState, formData: FormData): Promise<SaveConfigState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session has expired. Sign in again.' };
  const { data: profile } = await supabase.from('admin_profiles').select('role').eq('user_id', user.id).single();
  if (!profile || profile.role !== 'admin') return { error: 'You are not authorized to change configuration.' };

  let rawConfig: unknown;
  try { rawConfig = JSON.parse(String(formData.get('config') ?? '')); } catch { return { error: 'The configuration payload is not valid JSON.' }; }
  const parsed = semesterConfigSchema.safeParse(rawConfig);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Configuration is invalid.' };
  const sectionName = String(formData.get('sectionName') ?? '').trim();
  if (!sectionName) return { error: 'Section name is required.' };
  const config = parsed.data;

  const { data: section, error: sectionError } = await supabase.from('sections').upsert({ name: sectionName }, { onConflict: 'name' }).select('id').single();
  if (sectionError || !section) return { error: sectionError?.message ?? 'Could not save section.' };
  const { data: semester, error: semesterError } = await supabase.from('semesters').upsert({ section_id: section.id, name: 'Current semester', start_date: config.semesterStart, end_date: config.semesterEnd }, { onConflict: 'section_id,name' }).select('id').single();
  if (semesterError || !semester) return { error: semesterError?.message ?? 'Could not save semester.' };

  const tables = ['timetable_periods', 'exam_periods', 'exam_period_days'] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('semester_id', semester.id);
    if (error) {
      if (table === 'exam_period_days') return { error: 'Exam day table is missing. Run migration 002_exam_day_overrides.sql in Supabase, then try again.' };
      return { error: `Could not replace ${table.replaceAll('_', ' ')}.` };
    }
  }
  const rows = {
    timetable_periods: config.timetable.map((period) => ({ semester_id: semester.id, weekday: period.weekday, sequence: period.sequence, start_time: period.start, end_time: period.end })),
    exam_periods: config.exams.map((exam) => ({ semester_id: semester.id, name: exam.name, start_date: exam.start, end_date: exam.end, periods_per_day: exam.periodsPerDay })),
  };
  if (rows.timetable_periods.length > 0) {
    const { error } = await supabase.from('timetable_periods').insert(rows.timetable_periods);
    if (error) return { error: 'Could not save timetable periods.' };
  }
  const { error: holidayDeleteError } = await supabase.from('universal_holidays').delete().not('id', 'is', null);
  if (holidayDeleteError) return { error: 'Universal calendar tables are missing. Run migration 003_universal_calendar.sql in Supabase, then try again.' };
  const universalHolidays = config.holidays.map((holiday) => ({ name: holiday.name, start_date: holiday.start, end_date: holiday.end }));
  if (universalHolidays.length > 0) {
    const { error } = await supabase.from('universal_holidays').insert(universalHolidays);
    if (error) return { error: 'Could not save universal holidays.' };
  }
  const { error: saturdayDeleteError } = await supabase.from('universal_special_saturdays').delete().not('id', 'is', null);
  if (saturdayDeleteError) return { error: 'Universal calendar tables are missing. Run migration 003_universal_calendar.sql in Supabase, then try again.' };
  const universalSaturdays = config.specialSaturdays.map((special) => ({ date: special.date, copied_weekday: special.copiedWeekday }));
  if (universalSaturdays.length > 0) {
    const { error } = await supabase.from('universal_special_saturdays').insert(universalSaturdays);
    if (error) return { error: 'Could not save universal special Saturdays.' };
  }
  if (rows.exam_periods.length > 0) {
    const { error } = await supabase.from('exam_periods').insert(rows.exam_periods);
    if (error) return { error: 'Could not save examinations.' };
  }
  const examDays = config.exams.flatMap((exam) => (exam.dailyPeriods ?? []).map((day) => ({ exam_name: exam.name, semester_id: semester.id, date: day.date, periods_per_day: day.periodsPerDay })));
  if (examDays.length > 0) {
    const { error } = await supabase.from('exam_period_days').insert(examDays);
    if (error) return { error: 'Could not save daily examination overrides.' };
  }
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: 'Configuration saved.' };
}
