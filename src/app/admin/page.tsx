import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ConfigEditor } from './ConfigEditor';
import { defaultConfig } from '@/lib/default-config';
import type { ScheduleConfig } from '@/domain/schedule/types';

type AdminPageProps = { searchParams: Promise<{ section?: string }> };

async function loadSectionConfig(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, sectionId: string): Promise<ScheduleConfig> {
  const { data: semester } = await supabase.from('semesters').select('id, start_date, end_date').eq('section_id', sectionId).eq('name', 'Current semester').single();
  if (!semester) return defaultConfig;
  const [{ data: timetable }, { data: holidays }, { data: specialSaturdays }, { data: exams }, { data: examDays }] = await Promise.all([
    supabase.from('timetable_periods').select('weekday, sequence, start_time, end_time').eq('semester_id', semester.id).order('weekday').order('sequence'),
    supabase.from('universal_holidays').select('name, start_date, end_date').order('start_date'),
    supabase.from('universal_special_saturdays').select('date, copied_weekday').order('date'),
    supabase.from('exam_periods').select('name, start_date, end_date, periods_per_day').eq('semester_id', semester.id),
    supabase.from('exam_period_days').select('exam_name, date, periods_per_day').eq('semester_id', semester.id),
  ]);
  return {
    semesterStart: semester.start_date,
    semesterEnd: semester.end_date,
    timetable: (timetable ?? []).map((period) => ({ weekday: period.weekday, sequence: period.sequence, start: String(period.start_time).slice(0, 5), end: String(period.end_time).slice(0, 5) })),
    holidays: (holidays ?? []).map((holiday) => ({ name: holiday.name, start: holiday.start_date, end: holiday.end_date })),
    specialSaturdays: (specialSaturdays ?? []).map((special) => ({ date: special.date, copiedWeekday: special.copied_weekday })),
    exams: (exams ?? []).map((exam) => ({ name: exam.name, start: exam.start_date, end: exam.end_date, periodsPerDay: exam.periods_per_day, dailyPeriods: (examDays ?? []).filter((day) => day.exam_name === exam.name).map((day) => ({ date: day.date, periodsPerDay: day.periods_per_day })) })),
  };
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <main className="admin-shell"><p className="eyebrow">First-time setup</p><h1>Connect Supabase in 5 minutes.</h1><p>Supabase is the secure online database that stores your timetable. Follow these steps once on your computer.</p><ol className="setup-steps"><li><strong>Create a project.</strong><span>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>, sign in, choose New project, and wait for it to finish.</span></li><li><strong>Copy two values.</strong><span>Open Project Settings → API. Copy the Project URL and the anon public key.</span></li><li><strong>Paste them into the right file.</strong><span>Open <code>.env.local</code> in this project. The filename must be exactly <code>.env.local</code>, not <code>.end.local</code>.</span><pre>NEXT_PUBLIC_SUPABASE_URL=your-project-url{`\n`}NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key</pre></li><li><strong>Create the tables.</strong><span>In Supabase, open SQL Editor → New query. Run <code>001_initial_schema.sql</code>, then <code>002</code>, <code>003</code>, <code>004_security_hardening.sql</code>, <code>005_atomic_save.sql</code> and <code>006_drop_legacy_calendar_tables.sql</code>, in that order.</span></li><li><strong>Restart this website.</strong><span>Stop the terminal with Ctrl+C, then run <code>npm run dev</code> again. Return to this page and sign in at <a href="/admin/login">/admin/login</a>.</span></li></ol><p className="setup-warning"><strong>Keep private:</strong> never share your database password or commit <code>.env.local</code> to Git.</p></main>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase.from('admin_profiles').select('role').eq('user_id', user.id).single();
  if (!profile) redirect('/');

  const { data: sections } = await supabase.from('sections').select('id, name').order('name');
  const availableSections = sections ?? [];
  const selectedSectionId = (await searchParams).section ?? availableSections[0]?.id;
  const selectedSection = availableSections.find((section) => section.id === selectedSectionId) ?? availableSections[0];
  const initialConfig = selectedSection ? await loadSectionConfig(supabase, selectedSection.id) : defaultConfig;

  return <main className="admin-shell"><p className="eyebrow">Admin configuration</p><h1>Schedule control room</h1><p>Authenticated as {user.email}. Keep the timetable current and the public calculation follows it.</p><ConfigEditor key={selectedSection?.id ?? 'new'} initialConfig={initialConfig} sections={availableSections} selectedSectionId={selectedSection?.id ?? ''} initialSectionName={selectedSection?.name ?? 'CSE 5'} /></main>;
}
