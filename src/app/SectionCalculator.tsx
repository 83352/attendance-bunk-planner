'use client';

import { useEffect, useState } from 'react';
import { Calculator } from './Calculator';
import type { ScheduleConfig } from '@/domain/schedule/types';
import type { SectionOption } from './SectionSelector';
import { SiteHeader } from './SiteHeader';

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
 *
 * If no section is selected, the chip selector is still shown but the
 * calculator body is replaced with a "pick a section" prompt.
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
    return <PageChrome sections={sections} activeId="" onSelect={setActiveId}>
      <p className="font-term text-[11px] leading-[1.5] text-muted">No sections are saved yet. Add one in the admin panel.</p>
    </PageChrome>;
  }

  if (!activeId) {
    return <PageChrome sections={sections} activeId="" onSelect={setActiveId}>
      <p className="font-term text-[12px] leading-[1.4] text-muted">Pick your section above to load its timetable.</p>
    </PageChrome>;
  }

  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  const config = configsBySection[active.id];
  const sectionName = namesBySection[active.id] ?? active.name;

  // The `key` remounts the Calculator on every section switch so the
  // current/target inputs and any rendered result reset cleanly.
  return <Calculator key={active.id} config={config} sectionName={sectionName} sections={sections} selectedSectionId={active.id} onSelectSection={setActiveId} />;
}

/**
 * Shared header + chip selector + footer used when no calculator body is
 * rendered (empty sections list or no section picked). Mirrors the layout
 * in Calculator.tsx so the page looks complete.
 */
function PageChrome({ sections, activeId, onSelect, children }: { sections: SectionOption[]; activeId: string; onSelect: (id: string) => void; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] min-h-[calc(100vh-47px)] px-5 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))] phone:px-3 phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[680px] border-[3px] border-black bg-paper px-[clamp(16px,2vw,24px)] pt-[clamp(17px,2vw,24px)] pb-[clamp(18px,2.2vw,26px)] shadow-hard animate-rise" aria-label="Attendance calculator">
          <div className="mb-[clamp(16px,2vw,22px)]">
            <p className="eyebrow-text mb-[3px] text-[10px] text-black">attendance desk</p>
            <h1 className="m-0 font-display text-[clamp(27px,4.4vw,40px)] leading-[.95] font-black tracking-[.2px] uppercase">Can I bunk?</h1>
          </div>
          <ChipRow sections={sections} activeId={activeId} onSelect={onSelect} />
          <div className="mt-[6px] grid gap-4">
            {children}
          </div>
        </section>
<a className="show-desktop mx-auto mt-[clamp(10px,1.6vw,16px)] min-h-11 w-full max-w-[680px] items-center justify-center py-[3px] text-center font-term text-[9px] font-black uppercase tracking-[.55px] text-muted underline decoration-link decoration-dotted decoration-[3px] underline-offset-[3px] hover:text-black" href="/admin">Owner? Admin panel</a>
      </main>
    </>
  );
}

function ChipRow({ sections, activeId, onSelect }: { sections: SectionOption[]; activeId: string; onSelect: (id: string) => void }) {
  if (sections.length === 0) return null;
  return (
    <label className="mb-[17px] block">
      <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
      <span className="mt-[7px] flex flex-wrap gap-2" role="group" aria-label="Choose your section">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={`inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold uppercase tracking-[.55px] transition-[transform,box-shadow,background] duration-100 hover:-translate-y-px ${isActive ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)] hover:shadow-[3px_3px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:shadow-[3px_3px_0_var(--shadow-color)]'}`}
              aria-pressed={isActive}
              aria-current={isActive ? 'page' : undefined}
            >
              {section.name}
            </button>
          );
        })}
      </span>
    </label>
  );
}
