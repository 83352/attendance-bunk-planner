import { Calculator } from './Calculator';
import { defaultConfig } from '@/lib/default-config';
import { loadSectionConfig } from '@/lib/load-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function loadPublicConfig(sectionId?: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { config: defaultConfig, sectionName: 'CSE 5', sections: [], selectedSectionId: '' };
  const { data: sectionRows } = await supabase.from('sections').select('id, name').order('name');
  const sections = sectionRows ?? [];
  const section = sections.find((item) => item.id === sectionId) ?? sections[0];
  if (!section) return { config: defaultConfig, sectionName: 'CSE 5', sections, selectedSectionId: '' };
  const { config } = await loadSectionConfig(supabase, section.id);
  return { config, sectionName: section.name, sections, selectedSectionId: section.id };
}


export default async function Home({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { config, sectionName, sections, selectedSectionId } = await loadPublicConfig((await searchParams).section);
  return <Calculator config={config} sectionName={sectionName} sections={sections} selectedSectionId={selectedSectionId} />;
}
