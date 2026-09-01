'use client';

export type SectionOption = { id: string; name: string };

/**
 * Renders the section chips as a plain flex row.
 *
 * NOTE: the wrapper is a <div>, not a <label>. A <label> forwards any click
 * inside its box to its first labelable descendant, so clicking the empty
 * space beside the last chip used to select the *first* section.
 */
export function SectionSelector({
  sections,
  selectedSectionId,
  onSelect,
}: {
  sections: SectionOption[];
  selectedSectionId: string;
  onSelect: (sectionId: string) => void;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="mb-[17px]">
      <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
      <span className="mt-[7px] flex flex-wrap gap-3" role="group" aria-label="Choose your section">
        {sections.map((section) => {
          const isActive = section.id === selectedSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={`btn-section-hover inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold uppercase tracking-[.55px] ${isActive ? 'border-chip-border text-chip-ink shadow-[5px_5px_0_var(--color-chip-shadow)] [animation:var(--animate-chip-pop)]' : 'border-black bg-surface text-black shadow-[5px_5px_0_var(--shadow-color)]'}`}
              aria-pressed={isActive}
            >
              {section.name}
            </button>
          );
        })}
      </span>
    </div>
  );
}
