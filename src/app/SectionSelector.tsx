'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { yearLabel } from '@/lib/academic-year';

export type SectionOption = { id: string; name: string; year: number };

type SectionSelectorProps = {
  sections: SectionOption[];
  selectedSectionId: string;
  onSelect: (sectionId: string) => void;
};

function safeViewTransition(callback: () => void) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && typeof document !== 'undefined' && 'startViewTransition' in document && !document.hidden) {
    const transition = (document as Document & { startViewTransition: (update: () => void) => ViewTransition }).startViewTransition(() => {
      flushSync(callback);
    });
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
  } else {
    callback();
  }
}

/**
 * Two-step branch picker.
 *
 * Step 1 shows one button per branch:
 *   - branches with 2+ members render as a branch chip; tapping advances
 *     to step 2 (the section chips inside that branch, plus a back button).
 *   - branches with exactly 1 member render as that section's chip directly
 *     so the user commits in a single tap.
 *
 * Sections whose names aren't in BRANCH_GROUPS are shown under Other and also
 * produce a development warning so the curated list can be extended later.
 */
export function SectionSelector({ sections, selectedSectionId, onSelect }: SectionSelectorProps) {
  if (sections.length === 0) return null;
  return <YearPicker sections={sections} selectedSectionId={selectedSectionId} onSelect={onSelect} />;
}

/**
 * Step 0: which academic year. Skipped entirely when only one year has
 * sections published, so while 3rd year is still being checked the picker
 * behaves exactly as it always has -- no dead tap for a choice of one.
 */
function YearPicker({ sections, selectedSectionId, onSelect }: SectionSelectorProps) {
  const years = useMemo(
    () => [...new Set(sections.map((section) => section.year))].sort((a, b) => a - b),
    [sections],
  );
  // null means "not navigated yet", matching BranchPicker: a section restored
  // from localStorage opens straight to its own year.
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const selectedYear = sections.find((section) => section.id === selectedSectionId)?.year;
  const activeYear = chosenYear ?? selectedYear ?? (years.length === 1 ? years[0] : null);

  const handleSelectYear = (year: number) => {
    safeViewTransition(() => setChosenYear(year));
  };

  const handleBackToYear = () => {
    safeViewTransition(() => {
      setChosenYear(null);
      onSelect('');
    });
  };

  if (years.length <= 1) {
    return <BranchPicker sections={sections} selectedSectionId={selectedSectionId} onSelect={onSelect} />;
  }

  if (activeYear == null) {
    return (
      <div className="mb-[17px]">
        <span className="text-[12px] leading-[1.1] font-black text-black">Your year</span>
        <div className="mt-[7px] flex flex-wrap gap-3" role="group" aria-label="Choose your year">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => handleSelectYear(year)}
              className="btn-section-hover inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 border-black bg-surface px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold text-black shadow-[5px_5px_0_var(--shadow-color)]"
            >
              {yearLabel(year)}
            </button>
          ))}
        </div>
        <p className="mt-[6px] mb-0 font-term text-[12px] leading-[1.4] text-muted">Pick your year above to see its sections.</p>
      </div>
    );
  }

  return (
    <BranchPicker
      sections={sections.filter((section) => section.year === activeYear)}
      selectedSectionId={selectedSectionId}
      onSelect={onSelect}
      onBack={handleBackToYear}
      backLabel={yearLabel(activeYear)}
      showYear
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Curated branch list. To add a future single-section branch (e.g. CIVIL),   */
/* append a new entry. The array order is the order branches are shown in    */
/* step 1, and the order inside each `members` list is the order the section  */
/* chips render in step 2.                                                    */
/* -------------------------------------------------------------------------- */

type BranchGroup = { label: string; members: string[] };

const BRANCH_GROUPS: BranchGroup[] = [
  { label: 'CSE & Allied', members: ['CSB', 'CSD', 'CSE 1', 'CSE 2', 'CSE 3', 'CSE 4', 'CSE 5', 'CSM', 'IT'] },
  { label: 'ECE',          members: ['ECE 1', 'ECE 2', 'ECE 3'] },
  { label: 'EEE',          members: ['EEE'] },
  { label: 'Mechanical',   members: ['MECH', 'MCT'] },
  { label: 'MME',          members: ['MME'] },
  { label: 'CIVIL',        members: ['CIVIL'] },
];

/** Index section names to their group label in O(1). Built once at module load. */
const GROUP_BY_NAME: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of BRANCH_GROUPS) for (const member of group.members) map.set(member.toLowerCase(), group.label);
  return map;
})();

function groupOf(name: string): string | null {
  return GROUP_BY_NAME.get(name.trim().toLowerCase()) ?? null;
}

type BranchStep = { kind: 'branches' } | { kind: 'group'; label: string };

/** Selected chip text: with several years published, the year is part of the identity (timetables differ between years). */
function chipLabel(section: SectionOption, isActive: boolean, showYear: boolean): string {
  return isActive && showYear ? `${yearLabel(section.year)} · ${section.name}` : section.name;
}

function BranchPicker({ sections, selectedSectionId, onSelect, onBack, backLabel, showYear = false }: { sections: SectionOption[]; selectedSectionId: string; onSelect: (id: string) => void; onBack?: () => void; backLabel?: string; showYear?: boolean }) {
  // null means "no explicit navigation yet" — the step then follows
  // `selectedSectionId` automatically (e.g. a section restored from
  // localStorage opens straight to its group). Once the user explicitly
  // taps a branch chip or Back, their choice sticks regardless of prop
  // changes.
  const [step, setStep] = useState<BranchStep | null>(null);

  // Build the buckets once per `sections` change. Single-member branches are
  // listed as `singleSections` so step 1 can render their lone section as a
  // chip and skip the second step entirely.
  const { multiGroups, singleSections, unmatched } = useMemo(() => {
    const buckets = new Map<string, SectionOption[]>();
    for (const group of BRANCH_GROUPS) buckets.set(group.label, []);
    const unmatched: SectionOption[] = [];
    for (const section of sections) {
      const label = groupOf(section.name);
      if (label === null) { unmatched.push(section); continue; }
      const list = buckets.get(label) ?? [];
      list.push(section);
    }
    const multiGroups = BRANCH_GROUPS
      .map((group) => ({ label: group.label, list: buckets.get(group.label) ?? [] }))
      .filter((entry) => entry.list.length >= 2);
    const singleSections: SectionOption[] = [];
    for (const group of BRANCH_GROUPS) {
      const list = buckets.get(group.label) ?? [];
      if (list.length === 1 && list[0]) singleSections.push(list[0]);
    }
    return { multiGroups, singleSections, unmatched };
  }, [sections]);

  // Surface unmatched section names once so a developer notices the list is stale.
  useEffect(() => {
    if (unmatched.length > 0 && typeof console !== 'undefined') {
      console.warn(`SectionSelector: no branch group for ${unmatched.map((section) => section.name).join(', ')}. Add them to BRANCH_GROUPS.`);
    }
  }, [unmatched]);

  // With no explicit navigation yet, default to the group containing the
  // active section (if any) so a restored or externally-set selection opens
  // straight to its group instead of the top-level branch list.
  const autoGroup = selectedSectionId
    ? multiGroups.find((group) => group.list.some((section) => section.id === selectedSectionId))
    : undefined;
  const autoStep: BranchStep = autoGroup ? { kind: 'group', label: autoGroup.label } : { kind: 'branches' };
  const rawStep = step ?? autoStep;
  // If `sections` changes such that the current step-2 group no longer has 2+
  // members, fall back to step 1 at render time instead of syncing state in
  // an effect (avoids the react-hooks/set-state-in-effect rule).
  const effectiveStep: BranchStep = rawStep.kind === 'group' && !multiGroups.some((g) => g.label === rawStep.label)
    ? { kind: 'branches' }
    : rawStep;
  const activeGroup = effectiveStep.kind === 'group' ? multiGroups.find((g) => g.label === effectiveStep.label) : undefined;

  const transitionBack = () => {
    safeViewTransition(() => {
      if (selectedSectionId) onSelect('');
      else setStep({ kind: 'branches' });
    });
  };

  const transitionSelect = (id: string) => {
    safeViewTransition(() => onSelect(id));
  };

  return (
    <div className="mb-[17px]">
      <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
      {effectiveStep.kind === 'branches' && onBack ? (
        <div className="mt-[7px] mb-3 flex items-center gap-3">
          <div style={{ viewTransitionName: 'back-btn' } as React.CSSProperties}>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 border-2 border-black bg-surface px-3 py-2 font-term text-[12px] font-bold text-black shadow-[2px_2px_0_var(--shadow-color)] transition-all duration-150 hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[4px_4px_0_var(--shadow-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-[1px_1px_0_var(--shadow-color)]"
            >
              <span aria-hidden="true">←</span> back
            </button>
          </div>
          <div className="flex-1 flex items-center whitespace-nowrap" style={{ viewTransitionName: 'section-label' } as React.CSSProperties}>
            <span className="font-term text-[12px] font-black text-black">{backLabel}</span>
          </div>
        </div>
      ) : null}
      {effectiveStep.kind === 'branches' ? (
        <div className="flex flex-wrap gap-3" role="group" aria-label="Choose your branch">
          {multiGroups.map((group) => (
            <button
              key={group.label}
              type="button"
              onClick={() => {
                safeViewTransition(() => setStep({ kind: 'group', label: group.label }));
              }}
              className="btn-section-hover inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 border-black bg-surface px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold text-black shadow-[5px_5px_0_var(--shadow-color)]"
            >
              {group.label} <span aria-hidden="true" className="ml-1 opacity-50">→</span>
            </button>
          ))}
          {singleSections.map((section) => {
            const isActive = section.id === selectedSectionId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => transitionSelect(section.id)}
                className={`btn-section-hover inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap border-2 px-4 py-2 font-term text-[12px] font-bold ${isActive ? 'border-chip-border text-chip-ink [animation:var(--animate-chip-pop)]' : 'border-black bg-surface text-black shadow-[3px_3px_0_var(--shadow-color)]'}`}
                aria-pressed={isActive}
                style={{ viewTransitionName: `section-${section.id}` } as React.CSSProperties}
              >
                {chipLabel(section, isActive, showYear)}
              </button>
            );
          })}
          {unmatched.length > 0 && <div className="flex basis-full flex-wrap gap-3" aria-label="Other sections">
            {unmatched.map((section) => {
              const isActive = section.id === selectedSectionId;
              return <button key={section.id} type="button" onClick={() => transitionSelect(section.id)} className={`btn-section-hover inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap border-2 px-4 py-2 font-term text-[12px] font-bold ${isActive ? 'border-chip-border text-chip-ink [animation:var(--animate-chip-pop)]' : 'border-black bg-surface text-black shadow-[3px_3px_0_var(--shadow-color)]'}`} aria-pressed={isActive} style={{ viewTransitionName: `section-${section.id}` } as React.CSSProperties}>{chipLabel(section, isActive, showYear)}</button>;
            })}
          </div>}
        </div>
      ) : (
        <div className="mt-[7px] flex flex-wrap items-center gap-3" role="group" aria-label={`Choose your section in ${activeGroup?.label ?? ''}`}>
          <div style={{ viewTransitionName: 'back-btn' } as React.CSSProperties}>
            <button
              type="button"
              onClick={transitionBack}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 border-2 border-black bg-surface px-3 py-2 font-term text-[12px] font-bold text-black shadow-[2px_2px_0_var(--shadow-color)] transition-all duration-150 hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[4px_4px_0_var(--shadow-color)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-[1px_1px_0_var(--shadow-color)]"
            >
              <span aria-hidden="true">←</span> back
            </button>
          </div>

          {!selectedSectionId && (
            <div
              className="flex-1 flex items-center whitespace-nowrap"
              style={{ viewTransitionName: 'section-label' } as React.CSSProperties}
            >
              <span className="font-term text-[12px] font-black text-black">
                {backLabel ? `${backLabel} · ${activeGroup?.label ?? ''}` : activeGroup?.label}
              </span>
            </div>
          )}

          {!selectedSectionId && <div className="w-full h-0 m-0" />}

          {activeGroup?.list.map((section) => {
            const isActive = section.id === selectedSectionId;
            if (selectedSectionId && !isActive) return null;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => transitionSelect(section.id)}
                className={`btn-section-hover inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap border-2 px-4 py-2 font-term text-[12px] font-bold ${
                  isActive
                    ? 'border-chip-border text-chip-ink [animation:var(--animate-chip-pop)]'
                    : 'border-black bg-surface text-black shadow-[3px_3px_0_var(--shadow-color)]'
                }`}
                aria-pressed={isActive}
                style={{ viewTransitionName: `section-${section.id}` } as React.CSSProperties}
              >
                {chipLabel(section, isActive, showYear)}
              </button>
            );
          })}
        </div>
      )}
      {!selectedSectionId && <p className="mt-[10px] mb-0 font-term text-[12px] leading-[1.4] text-muted">Pick your section above to load its timetable.</p>}
    </div>
  );
}
