import Link from 'next/link';

export type SectionOption = { id: string; name: string };

export function SectionSelector({ sections, selectedSectionId }: { sections: SectionOption[]; selectedSectionId: string }) {
  if (sections.length === 0) return null;
  return (
    <label className="public-section">
      Your section
      <span className="section-chips" role="group" aria-label="Choose your section">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/?section=${section.id}`}
            prefetch={false}
            className={`section-chip${section.id === selectedSectionId ? ' active' : ''}`}
            aria-current={section.id === selectedSectionId ? 'page' : undefined}
          >
            {section.name}
          </Link>
        ))}
      </span>
    </label>
  );
}
