'use client';

import { useEffect, useState } from 'react';
import { Calculator } from './Calculator';
import type { ScheduleConfig } from '@/domain/schedule/types';
import type { SectionOption } from './SectionSelector';
import Link from 'next/link';

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
      <header className="relative flex min-h-[47px] items-center justify-center border-b-[3px] border-[#111111] bg-[#111111] px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-[10px] text-[#f5f2e9] phone:min-h-[52px] phone:justify-start phone:px-[18px]">
        <Link className="font-display text-[16px] leading-none font-black tracking-[0.75px] no-underline text-[#f5f2e9] phone:text-[17px]" href="/" aria-label="dontbunk home">
          dont<span className="text-[#b7f14a]">bunk</span>
        </Link>
        <span className="absolute right-6 rotate-45 text-[14px] text-lime phone:right-5" aria-hidden="true">◆</span>
      </header>
      <main className="mx-auto w-full max-w-[680px] min-h-[calc(100vh-47px)] px-5 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))] phone:px-3 phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[294px] border-[3px] border-black bg-paper px-4 pt-[17px] pb-[18px] shadow-hard animate-rise phone:max-w-[420px] phone:pt-[18px] phone:pb-5" aria-label="Attendance calculator">
          <div className="mb-4 flex items-start gap-3 phone:mb-[19px] phone:gap-2.5">
            <span className="mt-px grid size-[27px] shrink-0 place-items-center border-2 border-black bg-orange font-term text-[11px] leading-none font-black text-white">01</span>
            <div>
              <p className="eyebrow-text mb-[3px] text-[10px] text-black">attendance desk</p>
              <h1 className="m-0 font-display text-[28px] leading-[.95] font-black tracking-[.2px] uppercase phone:text-[clamp(27px,8vw,35px)]">Can I bunk?</h1>
            </div>
          </div>
          <ChipRow sections={sections} activeId={activeId} onSelect={onSelect} />
          <div className="mt-[6px] grid gap-4">
            {children}
          </div>
        </section>
        <a className="mx-auto mt-3 flex min-h-11 w-full max-w-[294px] items-center justify-center py-[3px] text-center font-term text-[9px] font-black uppercase tracking-[.55px] text-muted underline decoration-link decoration-dotted decoration-[3px] underline-offset-[3px] hover:text-black phone:mt-2.5 phone:max-w-[420px]" href="/admin">Owner? Admin panel</a>
      </main>
    </>
  );
}

function ChipRow({ sections, activeId, onSelect }: { sections: SectionOption[]; activeId: string; onSelect: (id: string) => void }) {
  if (sections.length === 0) return null;
  return (
    <label className="mb-[17px] block">
      Your section
      <span className="mt-[7px] flex flex-wrap gap-2" role="group" aria-label="Choose your section">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={`inline-flex min-h-[38px] cursor-pointer items-center justify-center border-2 px-3 py-2 font-term text-[11px] font-bold uppercase tracking-[.55px] transition-[transform,box-shadow,background] duration-100 hover:-translate-y-px ${isActive ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)] hover:shadow-[3px_3px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:shadow-[3px_3px_0_var(--shadow-color)]'}`}
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
