'use client';

import { useEffect, useMemo, useState } from 'react';

export type SectionOption = { id: string; name: string };

type SectionSelectorProps = {
  sections: SectionOption[];
  selectedSectionId: string;
  onSelect: (sectionId: string) => void;
};

/**
 * Two-step branch picker.
 *
 * Step 1 shows one button per branch:
 *   - branches with 2+ members render as a branch chip; tapping advances
 *     to step 2 (the section chips inside that branch, plus a back button).
 *   - branches with exactly 1 member render as that section's chip directly
 *     so the user commits in a single tap.
 *
 * Sections whose names aren't in BRANCH_GROUPS are dropped; a dev-only
 * console.warn lists them so we know to extend the curated list.
 */
export function SectionSelector({ sections, selectedSectionId, onSelect }: SectionSelectorProps) {
  if (sections.length === 0) return null;
  return <BranchPicker sections={sections} selectedSectionId={selectedSectionId} onSelect={onSelect} />;
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
  { label: 'Mechnical',    members: ['MECH', 'MCT'] },
  { label: 'MME',          members: ['MME'] },
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

function BranchPicker({ sections, selectedSectionId, onSelect }: { sections: SectionOption[]; selectedSectionId: string; onSelect: (id: string) => void }) {
  const [step, setStep] = useState<BranchStep>({ kind: 'branches' });

  // Build the buckets once per `sections` change. Single-member branches are
  // listed as `singleSections` so step 1 can render their lone section as a
  // chip and skip the second step entirely.
  const { multiGroups, singleSections, unmatched } = useMemo(() => {
    const buckets = new Map<string, SectionOption[]>();
    for (const group of BRANCH_GROUPS) buckets.set(group.label, []);
    const unmatchedNames: string[] = [];
    for (const section of sections) {
      const label = groupOf(section.name);
      if (label === null) { unmatchedNames.push(section.name); continue; }
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
    return { multiGroups, singleSections, unmatched: unmatchedNames };
  }, [sections]);

  // Surface unmatched section names once so a developer notices the list is stale.
  useEffect(() => {
    if (unmatched.length > 0 && typeof console !== 'undefined') {
      console.warn(`SectionSelector: no branch group for ${unmatched.join(', ')}. Add them to BRANCH_GROUPS.`);
    }
  }, [unmatched]);

  // If `sections` changes such that the current step-2 group no longer has 2+
  // members, fall back to step 1 at render time instead of syncing state in
  // an effect (avoids the react-hooks/set-state-in-effect rule).
  const effectiveStep: BranchStep = step.kind === 'group' && !multiGroups.some((g) => g.label === step.label)
    ? { kind: 'branches' }
    : step;
  const activeGroup = effectiveStep.kind === 'group' ? multiGroups.find((g) => g.label === effectiveStep.label) : undefined;

  return (
    <div className="mb-[17px]">
      <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
      {effectiveStep.kind === 'branches' ? (
        <div className="mt-[7px] flex flex-wrap gap-3" role="group" aria-label="Choose your branch">
          {multiGroups.map((group) => (
            <button
              key={group.label}
              type="button"
              onClick={() => setStep({ kind: 'group', label: group.label })}
              className="btn-section-hover inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 border-black bg-surface px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold uppercase tracking-[.55px] text-black shadow-[5px_5px_0_var(--shadow-color)]"
            >
              {group.label} <span aria-hidden="true" className="ml-2 font-term text-[14px]">↗</span>
            </button>
          ))}
          {singleSections.map((section) => {
            const isActive = section.id === selectedSectionId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelect(section.id)}
                className={`btn-section-hover inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold uppercase tracking-[.55px] ${isActive ? 'border-chip-border text-chip-ink [animation:var(--animate-chip-pop)]' : 'border-black bg-surface text-black shadow-[5px_5px_0_var(--shadow-color)]'}`}
                aria-pressed={isActive}
              >
                {section.name}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-[7px] flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep({ kind: 'branches' })}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border-2 border-black bg-surface px-3 py-1.5 font-term text-[11px] font-bold uppercase tracking-[.4px] text-black shadow-[2px_2px_0_var(--shadow-color)] hover:bg-cream"
            >
              <span aria-hidden="true">←</span> back
            </button>
            <span className="font-term text-[10px] font-black uppercase tracking-[.55px] text-muted">{activeGroup?.label}</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Choose your section in ${activeGroup?.label ?? ''}`}>
            {activeGroup?.list.map((section) => {
              const isActive = section.id === selectedSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSelect(section.id)}
                  className={`btn-section-hover inline-flex min-h-9 cursor-pointer items-center justify-center border-2 px-3 py-1.5 font-term text-[11px] font-bold uppercase tracking-[.4px] ${isActive ? 'border-chip-border text-chip-ink' : 'border-black bg-surface text-black shadow-[3px_3px_0_var(--shadow-color)]'}`}
                  aria-pressed={isActive}
                >
                  {section.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
