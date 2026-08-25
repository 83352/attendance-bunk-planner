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

  const examDays = config.exams.flatMap((exam) => (exam.dailyPeriods ?? []).map((day) => ({ examName: exam.name, date: day.date, periodsPerDay: day.periodsPerDay })));

  // The entire swap runs inside one Postgres transaction (migration
  // 005_atomic_save.sql), so a failure part-way through can no longer leave
  // half-saved state behind. The function re-checks admin rights itself.
  const { error } = await supabase.rpc('save_semester_config', {
    p_section_name: sectionName,
    p_semester_start: config.semesterStart,
    p_semester_end: config.semesterEnd,
    p_timetable: config.timetable,
    p_exams: config.exams.map((exam) => ({ name: exam.name, start: exam.start, end: exam.end, periodsPerDay: exam.periodsPerDay })),
    p_exam_days: examDays,
    p_holidays: config.holidays,
    p_special_saturdays: config.specialSaturdays,
  });

  if (error) {
    const missingRpc = error.message.includes('schema cache') || error.message.includes('function public.save_semester_config');
    if (missingRpc) return { error: 'Atomic save is not installed yet. Run migration 005_atomic_save.sql in Supabase, then try again.' };
    if (error.code === '42501' || error.message.includes('administrator')) return { error: 'You are not authorized to change configuration.' };
    return { error: `Could not save the configuration. ${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: 'Configuration saved.' };
}
