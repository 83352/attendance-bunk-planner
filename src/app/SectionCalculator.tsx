'use client';

import { Calculator } from './Calculator';
import type { ScheduleConfig } from '@/domain/schedule/types';
import type { SectionOption } from './SectionSelector';
import { SiteHeader } from './SiteHeader';

type SectionCalculatorProps = {
  sections: SectionOption[];
  /** Map of section id -> that section's loaded ScheduleConfig. */
  configsBySection: Record<string, ScheduleConfig>;
  /** Display name for each section id. */
  namesBySection: Record<string, string>;
};

/**
 * Wraps the Calculator with instant client-side section switching.
 *
 * The home page server-renders the config for every section once. We render
 * a single Calculator and hand it the full set of configs; the active section
 * lives in Calculator state. This keeps the calculator card mounted across
 * section changes so the rise-in animation only plays on first load — no
 * slide-up/fade-in flash when the user switches sections.
 *
 * The URL is intentionally NOT written: the page always starts blank, so
 * refreshing (or clicking the dontbunk logo) drops the user back to the
 * picker.
 */
export function SectionCalculator({ sections, configsBySection, namesBySection }: SectionCalculatorProps) {
  if (sections.length === 0) {
    return <EmptyState />;
  }

  // Calculator owns its own home-click reset, so the logo "just works"
  // without any prop threading.
  return <Calculator sections={sections} configsBySection={configsBySection} namesBySection={namesBySection} />;
}

/**
 * Shown only when there are zero sections in the database. Renders the
 * header + an empty chip row + a prompt to use the admin panel. Mirrors
 * the layout in Calculator.tsx so the page looks complete.
 */
function EmptyState() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] min-h-[calc(100vh-47px)] px-5 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))] phone:px-3 phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[680px] border-[3px] border-black bg-paper px-[clamp(16px,2vw,24px)] pt-[clamp(17px,2vw,24px)] pb-[clamp(18px,2.2vw,26px)] shadow-hard animate-rise" aria-label="Attendance calculator">
          <div className="mb-[clamp(16px,2vw,22px)]">
            <p className="eyebrow-text mb-[3px] text-[10px] text-black">attendance desk</p>
            <h1 className="m-0 font-display text-[clamp(27px,4.4vw,40px)] leading-[.95] font-black tracking-[.2px] uppercase">Can I bunk?</h1>
          </div>
          <div className="mb-[17px]">
            <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
            <p className="mt-[7px] font-term text-[12px] leading-[1.4] text-muted">No sections are saved yet. Add one in the admin panel.</p>
          </div>
        </section>
<a className="show-desktop mx-auto mt-[clamp(10px,1.6vw,16px)] min-h-11 w-full max-w-[680px] items-center justify-center py-[3px] text-center font-term text-[9px] font-black uppercase tracking-[.55px] text-muted underline decoration-link decoration-dotted decoration-[3px] underline-offset-[3px] hover:text-black" href="/admin">Owner? Admin panel</a>
      </main>
    </>
  );
}


