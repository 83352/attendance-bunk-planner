import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminShell } from './AdminShell';
import { ConfigEditor } from './ConfigEditor';
import { defaultConfig } from '@/lib/default-config';
import { loadAllSectionConfigs } from '@/lib/load-config';

type AdminPageProps = { searchParams: Promise<{ section?: string }> };

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <AdminShell><p className="eyebrow-text mb-[7px] font-term text-[10px] uppercase tracking-[.55px] text-black">First-time setup</p><h1 className="mb-3.5 font-display text-[40px] leading-[.95] font-black uppercase tracking-[.2px] phone:text-[clamp(32px,10vw,44px)]">Connect Supabase in 5 minutes.</h1><p className="max-w-[620px] font-term text-[13px] leading-[1.55] text-muted">Supabase is the secure online database that stores your timetable. Follow these steps once on your computer.</p><ol className="setup-steps"><li><strong>Create a project.</strong><span>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>, sign in, choose New project, and wait for it to finish.</span></li><li><strong>Copy two values.</strong><span>Open Project Settings → API. Copy the Project URL and the anon public key.</span></li><li><strong>Paste them into the right file.</strong><span>Open <code>.env.local</code> in this project. The filename must be exactly <code>.env.local</code>, not <code>.end.local</code>.</span><pre>NEXT_PUBLIC_SUPABASE_URL=your-project-url{`\n`}NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key</pre></li><li><strong>Create the tables.</strong><span>In Supabase, open SQL Editor → New query. Run <code>001_initial_schema.sql</code>, then <code>002</code>, <code>003</code>, <code>004_security_hardening.sql</code>, <code>005_atomic_save.sql</code>, <code>006_drop_legacy_calendar_tables.sql</code>, <code>007_optimistic_locking.sql</code>, <code>008_rls_performance.sql</code>, <code>009_lock_millisecond_precision.sql</code> and <code>010_custom_exam_names.sql</code>, then <code>011_safe_configuration_save.sql</code>, in that order.</span></li><li><strong>Restart this website.</strong><span>Stop the terminal with Ctrl+C, then run <code>npm run dev</code> again. Return to this page and sign in at <a href="/admin/login">/admin/login</a>.</span></li></ol><p className="setup-warning"><strong>Keep private:</strong> never share your database password or commit <code>.env.local</code> to Git.</p></AdminShell>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase.from('admin_profiles').select('role').eq('user_id', user.id).single();
  if (!profile) redirect('/');

  const { data: sections, error: sectionsError } = await supabase.from('sections').select('id, name').order('name');
  if (sectionsError) throw new Error('Unable to load sections.');
  const availableSections = sections ?? [];
  // Pre-load every section's config so the client can switch sections
  // without a server round-trip. The dropdown update becomes a pure
  // client-side state change instead of a full RSC re-render.
  const configsBySection = await loadAllSectionConfigs(supabase, availableSections);
  const updatedAtBySection: Record<string, string | null> = await loadUpdatedAtBySection(supabase, availableSections);
  const { data: calendarVersion, error: calendarVersionError } = await supabase.from('universal_calendar_version').select('updated_at').eq('id', true).single();
  if (calendarVersionError) throw new Error('Unable to load the shared calendar version.');
  const requestedSectionId = (await searchParams).section;
  const initialSection = availableSections.find((section) => section.id === requestedSectionId) ?? availableSections[0] ?? null;
  const initialSectionId = initialSection?.id ?? '';
  const initialConfig = initialSection ? (configsBySection[initialSection.id] ?? defaultConfig) : defaultConfig;
  const initialSectionName = initialSection?.name ?? 'CSE 5';

return <AdminShell><p className="eyebrow-text mb-[7px] font-term text-[10px] uppercase tracking-[.55px] text-black">Admin configuration</p><h1 className="mb-3.5 font-display text-[40px] leading-[.95] font-black uppercase tracking-[.2px] phone:text-[clamp(32px,10vw,44px)]">Schedule control room</h1><p className="max-w-[620px] font-term text-[13px] leading-[1.55] text-muted">Authenticated as {user.email}. Keep the timetable current and the public calculation follows it.</p><ConfigEditor initialConfig={initialConfig} sections={availableSections} initialSectionId={initialSectionId} initialSectionName={initialSectionName} configsBySection={configsBySection} updatedAtBySection={updatedAtBySection} calendarUpdatedAt={calendarVersion.updated_at} /></AdminShell>;
}

/**
 * Fetches the optimistic-lock timestamp for each section in one fan-out.
 * Mirrors `loadAllSectionConfigs` so the admin editor can show the right
 * `updatedAt` value when the user switches sections without a server hop.
 */
async function loadUpdatedAtBySection(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  sections: { id: string; name: string }[],
): Promise<Record<string, string | null>> {
  if (sections.length === 0) return {};
  const { data: semesters } = await supabase
    .from('semesters')
    .select('section_id, updated_at')
    .eq('name', 'Current semester')
    .in('section_id', sections.map((section) => section.id));
  const found = Object.fromEntries(
    (semesters ?? []).map((row) => [row.section_id as string, (row.updated_at as string | null) ?? null] as const),
  );
  return Object.fromEntries(sections.map((section) => [section.id, found[section.id] ?? null] as const));
}
