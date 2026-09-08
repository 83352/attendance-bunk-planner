import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionSelector, type SectionOption } from './SectionSelector';

// Rendered to static markup rather than a DOM: this project has no jsdom, and
// the behaviour worth pinning here is which step the picker opens on and which
// sections it is willing to offer -- both decided during render.
function render(sections: SectionOption[], selectedSectionId = '') {
  return renderToStaticMarkup(
    createElement(SectionSelector, { sections, selectedSectionId, onSelect: () => {} }),
  );
}

const secondYear: SectionOption[] = [
  { id: 's-cse1', name: 'CSE 1', year: 2 },
  { id: 's-cse2', name: 'CSE 2', year: 2 },
  { id: 's-eee', name: 'EEE', year: 2 },
];
const thirdYear: SectionOption[] = [
  { id: 't-cse1', name: 'CSE 1', year: 3 },
  { id: 't-cse2', name: 'CSE 2', year: 3 },
  { id: 't-eee', name: 'EEE', year: 3 },
];

describe('SectionSelector year step', () => {
  it('skips the year step when only one year is published', () => {
    const html = render(secondYear);
    // While 3rd year is still hidden the picker must behave as it always has:
    // a choice of one is a dead tap.
    expect(html).not.toContain('Your year');
    expect(html).toContain('Your section');
  });

  it('asks for the year first once two years are published', () => {
    const html = render([...secondYear, ...thirdYear]);
    expect(html).toContain('Your year');
    expect(html).toContain('2nd year');
    expect(html).toContain('3rd year');
    // The branch step must not be rendered underneath the year step, or both
    // years' identically named sections would be reachable at once.
    expect(html).not.toContain('Your section');
  });

  it('offers only the chosen year’s sections once a year is active', () => {
    // A section restored from localStorage opens straight to its own year.
    const html = render([...secondYear, ...thirdYear], 't-eee');
    expect(html).toContain('Your section');
    expect(html).toContain('3rd year');
    // EEE is a single-member branch, so its chip renders at the branch step.
    // Both years have one and the chips are labelled only by name, so the
    // guard against cross-year leakage is that exactly one chip exists.
    expect(html.match(/>EEE</g) ?? []).toHaveLength(1);
  });

  it('opens on the year of the selected section, not the lowest year', () => {
    const html = render([...secondYear, ...thirdYear], 't-cse1');
    expect(html).toContain('3rd year');
    expect(html).not.toContain('2nd year');
  });

  it('renders nothing when there are no sections', () => {
    expect(render([])).toBe('');
  });
});
