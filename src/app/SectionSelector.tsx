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
      <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
      <span className="mt-[7px] flex flex-wrap gap-2" role="group" aria-label="Choose your section">
        {sections.map((section) => {
          const isActive = section.id === selectedSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={`inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold uppercase tracking-[.55px] transition-[background] duration-100 ${isActive ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:bg-cream'}`}
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
