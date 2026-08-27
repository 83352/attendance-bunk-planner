import Link from 'next/link';

export type SectionOption = { id: string; name: string };

export function SectionSelector({ sections, selectedSectionId }: { sections: SectionOption[]; selectedSectionId: string }) {
  if (sections.length === 0) return null;
  return (
<label className="mb-[17px] block">
      Your section
      <span className="mt-[7px] flex flex-wrap gap-2" role="group" aria-label="Choose your section">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/?section=${section.id}`}
            prefetch={false}
            className={`inline-flex min-h-[38px] items-center justify-center border-2 px-3 py-2 font-term text-[11px] font-bold uppercase tracking-[.55px] no-underline transition-[transform,box-shadow,background] duration-100 hover:-translate-y-px ${section.id === selectedSectionId ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)] hover:shadow-[3px_3px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:shadow-[3px_3px_0_var(--shadow-color)]'}`}
            aria-current={section.id === selectedSectionId ? 'page' : undefined}
          >
            {section.name}
          </Link>
        ))}
      </span>
    </label>
  );
}
