import { defaultConfig } from '@/lib/default-config';
import { loadAllSectionConfigs } from '@/lib/load-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { SECTION_COOKIE } from '@/lib/section-cookie';
import { SectionCalculator } from './SectionCalculator';

export default async function Home() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    // No backend: fall back to a single hard-coded section so the UI still renders.
    const sections = [{ id: '', name: 'CSE 5', year: 2 }];
    return <SectionCalculator sections={sections} configsBySection={{ '': defaultConfig }} namesBySection={{ '': 'CSE 5' }} />;
  }

  // is_ready gates public visibility. Sections seeded for a new academic year
  // start as a copy of another year's timetable, so until an admin has checked
  // one it would hand students a precise, plausible, wrong bunk count.
  const { data: sectionRows, error: sectionsError } = await supabase
    .from('sections')
    .select('id, name, year')
    .eq('is_ready', true)
    .order('year')
    .order('name');
  if (sectionsError) throw new Error('Unable to load sections.');
  const sections = (sectionRows ?? []).map((row) => ({ id: row.id, name: row.name, year: row.year as number }));

  if (sections.length === 0) {
    return <SectionCalculator sections={[]} configsBySection={{}} namesBySection={{}} />;
  }

  // Load every section's config in parallel so the client can switch instantly.
  const configsBySection = await loadAllSectionConfigs(supabase, sections);
  const namesBySection: Record<string, string> = Object.fromEntries(sections.map((section) => [section.id, section.name]));

  // A ?section= in the URL is ignored on purpose; the only memory is the
  // cookie the calculator sets when a section is picked, so the logo can
  // still drop back to a blank picker without a shareable link re-selecting.
  const remembered = (await cookies()).get(SECTION_COOKIE)?.value ?? '';
  const initialSectionId = sections.some((section) => section.id === remembered) ? remembered : '';
  return <SectionCalculator sections={sections} configsBySection={configsBySection} namesBySection={namesBySection} initialSectionId={initialSectionId} />;
}
