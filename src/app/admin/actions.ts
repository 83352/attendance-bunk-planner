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
  const activeSectionId = String(formData.get('activeSectionId') ?? '').trim();
  const updatedAtRaw = String(formData.get('updatedAt') ?? '').trim();
  // The lock timestamp is compared for exact equality in save_semester_config.
  // Postgres stores it with microsecond precision, but a JS Date only keeps
  // milliseconds — round-tripping through `new Date()` truncates the value and
  // makes the check fail on every save. Validate it, then pass the original
  // string through unchanged so the comparison stays exact.
  if (updatedAtRaw !== '' && Number.isNaN(new Date(updatedAtRaw).getTime())) return { error: 'The configuration lock timestamp is invalid. Reload the page and try again.' };
  const updatedAt = updatedAtRaw === '' ? null : updatedAtRaw;
  const config = parsed.data;

  const examDays = config.exams.flatMap((exam) => (exam.dailyPeriods ?? []).map((day) => ({ examName: exam.name, date: day.date, periodsPerDay: day.periodsPerDay })));

  // Rename (if the submitted name differs from the row in the database).
  // Done before the RPC so the upsert in save_semester_config finds the row
  // by its new name. Skipped when the form was opened for a section the
  // user has not yet created (no activeSectionId, e.g. brand-new admin).
  if (activeSectionId) {
    const { data: currentRow, error: lookupError } = await supabase
      .from('sections')
      .select('name')
      .eq('id', activeSectionId)
      .single();
    if (lookupError) return { error: `Could not load the current section name. ${lookupError.message}` };
    const currentName = (currentRow?.name ?? '').trim();
    if (currentName && currentName !== sectionName) {
      const { error: renameError } = await supabase
        .from('sections')
        .update({ name: sectionName })
        .eq('id', activeSectionId);
      if (renameError) {
        if (renameError.code === '23505') return { error: 'A section with that name already exists.' };
        if (renameError.code === '42501' || renameError.message.includes('administrator')) return { error: 'You are not authorized to change configuration.' };
        return { error: `Could not rename the section. ${renameError.message}` };
      }
    }
  }

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
    p_expected_updated_at: updatedAt,
  });

  if (error) {
    const missingRpc = error.message.includes('schema cache') || error.message.includes('function public.save_semester_config');
    if (missingRpc) return { error: 'Atomic save is not installed yet. Run migrations 005_atomic_save.sql and 007_optimistic_locking.sql in Supabase, then try again.' };
    if (error.code === '40001' || error.message.includes('changed by someone else')) {
      return { error: 'This schedule was saved from somewhere else while you were editing. Reload the page to get the latest version, then apply your changes again.' };
    }
    if (error.code === '42501' || error.message.includes('administrator')) return { error: 'You are not authorized to change configuration.' };
    return { error: `Could not save the configuration. ${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: 'Configuration saved.' };
}

export async function deleteSection(_: SaveConfigState, formData: FormData): Promise<SaveConfigState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session has expired. Sign in again.' };
  const { data: profile } = await supabase.from('admin_profiles').select('role').eq('user_id', user.id).single();
  if (!profile || profile.role !== 'admin') return { error: 'You are not authorized to change configuration.' };

  const sectionId = String(formData.get('sectionId') ?? '');
  if (!sectionId) return { error: 'Choose a section to delete.' };

  // Deleting a section cascades to its semesters and every schedule row.
  // Universal holidays and special Saturdays are intentionally kept.
  const { error } = await supabase.from('sections').delete().eq('id', sectionId);
  if (error) return { error: `Could not delete the section. ${error.message}` };

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: 'Section deleted.' };
}
