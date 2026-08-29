'use client';

export type SectionOption = { id: string; name: string };

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
    <label className="mb-[17px] block">
      Your section
      <span className="mt-[7px] flex flex-wrap gap-2" role="group" aria-label="Choose your section">
        {sections.map((section) => {
          const isActive = section.id === selectedSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={`inline-flex min-h-[38px] cursor-pointer items-center justify-center border-2 px-3 py-2 font-term text-[11px] font-bold uppercase tracking-[.55px] transition-[transform,box-shadow,background] duration-100 hover:-translate-y-px ${isActive ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)] hover:shadow-[3px_3px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:shadow-[3px_3px_0(var--shadow-color)]'} focus-visible:outline-2 focus-visible:outline-lime focus-visible:outline-offset-2`}
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
