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
              className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center border-2 px-4 py-2.5 font-term text-[12px] font-bold uppercase tracking-[.55px] transition-[transform,box-shadow,background] duration-100 hover:-translate-y-px phone:min-h-[50px] phone:px-5 phone:py-3 phone:text-[13px] ${isActive ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)] hover:shadow-[3px_3px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:shadow-[3px_3px_0_var(--shadow-color)]'}`}
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
