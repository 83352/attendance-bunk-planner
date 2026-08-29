import { defaultConfig } from '@/lib/default-config';
import { loadAllSectionConfigs } from '@/lib/load-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SectionCalculator } from './SectionCalculator';

export default async function Home({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const requestedSection = (await searchParams).section;

  if (!supabase) {
    // No backend: fall back to a single hard-coded section so the UI still renders.
    const sections = [{ id: '', name: 'CSE 5' }];
    return <SectionCalculator sections={sections} initialSectionId="" configsBySection={{ '': defaultConfig }} namesBySection={{ '': 'CSE 5' }} />;
  }

  const { data: sectionRows } = await supabase.from('sections').select('id, name').order('name');
  const sections = (sectionRows ?? []).map((row) => ({ id: row.id, name: row.name }));

  if (sections.length === 0) {
    return <SectionCalculator sections={[]} initialSectionId="" configsBySection={{}} namesBySection={{}} />;
  }

  // Load every section's config in parallel so the client can switch instantly.
  const configsBySection = await loadAllSectionConfigs(supabase, sections);
  const namesBySection: Record<string, string> = Object.fromEntries(sections.map((section) => [section.id, section.name]));

  const initialSectionId = sections.find((section) => section.id === requestedSection)?.id ?? sections[0].id;

  return <SectionCalculator sections={sections} initialSectionId={initialSectionId} configsBySection={configsBySection} namesBySection={namesBySection} />;
}
