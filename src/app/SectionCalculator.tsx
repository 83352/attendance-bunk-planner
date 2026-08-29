'use client';

import { useEffect, useState } from 'react';
import { Calculator } from './Calculator';
import type { ScheduleConfig } from '@/domain/schedule/types';
import type { SectionOption } from './SectionSelector';

type SectionCalculatorProps = {
  sections: SectionOption[];
  initialSectionId: string;
  /** Map of section id -> that section's loaded ScheduleConfig. */
  configsBySection: Record<string, ScheduleConfig>;
  /** Display name for each section id. */
  namesBySection: Record<string, string>;
};

/**
 * Wraps the Calculator with instant client-side section switching.
 *
 * The home page server-renders the config for every section once. When the
 * user clicks a section chip we flip local state and re-render with the new
 * config — no network call, no full page reload, no flicker. The URL is
 * kept in sync so the page is still shareable and the browser back/forward
 * buttons work.
 */
export function SectionCalculator({ sections, initialSectionId, configsBySection, namesBySection }: SectionCalculatorProps) {
  const [activeId, setActiveId] = useState(initialSectionId);

  // Keep the URL in sync with the active section so links remain shareable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activeId) url.searchParams.set('section', activeId);
    else url.searchParams.delete('section');
    window.history.replaceState(null, '', url.toString());
  }, [activeId]);

  if (sections.length === 0) {
    return <Calculator config={undefined as unknown as ScheduleConfig} sectionName="CSE 5" sections={sections} selectedSectionId="" />;
  }

  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  const config = configsBySection[active.id];
  const sectionName = namesBySection[active.id] ?? active.name;

  // The `key` remounts the Calculator on every section switch so the
  // current/target inputs and any rendered result reset cleanly.
  return <Calculator key={active.id} config={config} sectionName={sectionName} sections={sections} selectedSectionId={active.id} onSelectSection={setActiveId} />;
}
