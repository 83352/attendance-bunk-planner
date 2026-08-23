import { Calculator } from './Calculator';
import { defaultConfig } from '@/lib/default-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ScheduleConfig } from '@/domain/schedule/types';

async function loadPublicConfig(sectionId?: string): Promise<{ config: ScheduleConfig; sectionName: string; sections: { id: string; name: string }[]; selectedSectionId: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { config: defaultConfig, sectionName: 'CSE 5', sections: [], selectedSectionId: '' };
  const { data: sectionRows } = await supabase.from('sections').select('id, name').order('name');
  const sections = sectionRows ?? [];
  const section = sections.find((item) => item.id === sectionId) ?? sections[0];
  if (!section) return { config: defaultConfig, sectionName: 'CSE 5', sections, selectedSectionId: '' };
  const { data: semester } = await supabase.from('semesters').select('id, start_date, end_date').eq('section_id', section.id).eq('name', 'Current semester').single();
  if (!semester) return { config: defaultConfig, sectionName: section.name, sections, selectedSectionId: section.id };
  const [{ data: timetable }, { data: holidays }, { data: specialSaturdays }, { data: exams }, { data: examDays }] = await Promise.all([
    supabase.from('timetable_periods').select('weekday, sequence, start_time, end_time').eq('semester_id', semester.id).order('weekday').order('sequence'),
    supabase.from('universal_holidays').select('name, start_date, end_date'),
    supabase.from('universal_special_saturdays').select('date, copied_weekday'),
    supabase.from('exam_periods').select('name, start_date, end_date, periods_per_day').eq('semester_id', semester.id),
    supabase.from('exam_period_days').select('exam_name, date, periods_per_day').eq('semester_id', semester.id),
  ]);
  const savedTimetable = (timetable ?? []).map((period) => ({ weekday: period.weekday, sequence: period.sequence, start: String(period.start_time).slice(0, 5), end: String(period.end_time).slice(0, 5) }));
  const configuredExams = exams && exams.length > 0 ? exams.map((item) => ({ name: item.name, start: item.start_date, end: item.end_date, periodsPerDay: item.periods_per_day, dailyPeriods: (examDays ?? []).filter((day) => day.exam_name === item.name).map((day) => ({ date: day.date, periodsPerDay: day.periods_per_day })) })) : defaultConfig.exams;
  return { sectionName: section.name, sections, selectedSectionId: section.id, config: { semesterStart: semester.start_date, semesterEnd: semester.end_date, timetable: savedTimetable.length > 0 ? savedTimetable : defaultConfig.timetable, holidays: (holidays ?? []).map((item) => ({ name: item.name, start: item.start_date, end: item.end_date })), specialSaturdays: (specialSaturdays ?? []).map((item) => ({ date: item.date, copiedWeekday: item.copied_weekday })), exams: configuredExams } };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { config, sectionName, sections, selectedSectionId } = await loadPublicConfig((await searchParams).section);
  return <Calculator config={config} sectionName={sectionName} sections={sections} selectedSectionId={selectedSectionId} />;
}
