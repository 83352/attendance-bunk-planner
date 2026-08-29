'use client';

import { useEffect, useRef, useState } from 'react';

export type SectionOption = { id: string; name: string };

/**
 * Roving-tabindex keyboard nav for a group of section chips. Left/Right
 * arrows move focus (wrapping), Home/End jump to the ends, Enter/Space
 * activates the focused chip. Focus follows the selected chip on mount
 * so the active section is always keyboard-reachable.
 */
function useChipKeyboardNav(sections: SectionOption[], selectedSectionId: string, onSelect: (id: string) => void) {
  const initialIndex = Math.max(0, sections.findIndex((s) => s.id === selectedSectionId));
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    buttonRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = sections.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((i) => (i >= last ? 0 : i + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((i) => (i <= 0 ? last : i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFocusedIndex(last);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = sections[focusedIndex];
      if (target) onSelect(target.id);
    }
  }

  return { focusedIndex, setFocusedIndex, buttonRefs, onKeyDown };
}

export function SectionSelector({
  sections,
  selectedSectionId,
  onSelect,
}: {
  sections: SectionOption[];
  selectedSectionId: string;
  onSelect: (sectionId: string) => void;
}) {
  const { focusedIndex, setFocusedIndex, buttonRefs, onKeyDown } = useChipKeyboardNav(sections, selectedSectionId, onSelect);
  if (sections.length === 0) return null;
  return (
    <label className="mb-[17px] block">
      <span className="text-[12px] leading-[1.1] font-black text-black">Your section</span>
      <span
        className="mt-[7px] flex flex-wrap gap-2"
        role="tablist"
        aria-label="Choose your section"
        onKeyDown={onKeyDown}
      >
        {sections.map((section, index) => {
          const isActive = section.id === selectedSectionId;
          const isFocused = index === focusedIndex;
          return (
            <button
              key={section.id}
              ref={(el) => { buttonRefs.current[index] = el; }}
              type="button"
              role="tab"
              tabIndex={isFocused ? 0 : -1}
              onClick={() => { onSelect(section.id); setFocusedIndex(index); }}
              className={`inline-flex min-h-[clamp(44px,5.6vw,56px)] cursor-pointer items-center justify-center border-2 px-[clamp(16px,2vw,22px)] py-[clamp(10px,1.2vw,14px)] font-term text-[clamp(12px,1.5vw,14px)] font-bold uppercase tracking-[.55px] transition-[background] duration-100 focus-visible:outline-2 focus-visible:outline-orange focus-visible:outline-offset-2 ${isActive ? 'border-chip-border bg-chip-bg text-chip-ink shadow-[2px_2px_0_var(--color-chip-shadow)]' : 'border-black bg-surface text-black shadow-[2px_2px_0_var(--shadow-color)] hover:bg-cream'}`}
              aria-selected={isActive}
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
