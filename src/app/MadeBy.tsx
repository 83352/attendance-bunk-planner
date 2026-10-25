/** Credit for the maker, linking to their LinkedIn. */
export const MAKER = { name: 'Teja', url: 'https://www.linkedin.com/in/pranav-teja-manchikatla/' };

export function MadeBy() {
  return (
    <p className="m-0 font-term text-[13px] text-muted">
      Made by{' '}
      <a href={MAKER.url} target="_blank" rel="noopener noreferrer" className="font-bold text-link underline decoration-link/40 underline-offset-2 transition-[text-decoration-color,text-underline-offset] duration-150 hover:decoration-link hover:underline-offset-4">
        {MAKER.name}<span className="sr-only"> (opens LinkedIn in a new tab)</span>
      </a>
    </p>
  );
}
