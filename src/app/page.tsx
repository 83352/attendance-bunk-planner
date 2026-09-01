import { defaultConfig } from '@/lib/default-config';
import { loadAllSectionConfigs } from '@/lib/load-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SectionCalculator } from './SectionCalculator';

export default async function Home() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    // No backend: fall back to a single hard-coded section so the UI still renders.
    const sections = [{ id: '', name: 'CSE 5' }];
    return <SectionCalculator sections={sections} configsBySection={{ '': defaultConfig }} namesBySection={{ '': 'CSE 5' }} />;
  }

  const { data: sectionRows } = await supabase.from('sections').select('id, name').order('name');
  const sections = (sectionRows ?? []).map((row) => ({ id: row.id, name: row.name }));

  if (sections.length === 0) {
    return <SectionCalculator sections={[]} configsBySection={{}} namesBySection={{}} />;
  }

  // Load every section's config in parallel so the client can switch instantly.
  const configsBySection = await loadAllSectionConfigs(supabase, sections);
  const namesBySection: Record<string, string> = Object.fromEntries(sections.map((section) => [section.id, section.name]));

  // Always start blank — the user (or the logo) picks a section, and any
  // ?section= in the URL is ignored so refresh never re-selects.
  return <SectionCalculator sections={sections} configsBySection={configsBySection} namesBySection={namesBySection} />;
}
