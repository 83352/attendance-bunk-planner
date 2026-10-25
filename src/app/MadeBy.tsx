/** Credit for the maker, linking to their LinkedIn, and a WhatsApp contact (opens a chat with a starter message). */
export const MAKER = {
  name: 'Teja',
  url: 'https://www.linkedin.com/in/pranav-teja-manchikatla/',
  whatsapp: `https://wa.me/917207684757?text=${encodeURIComponent('Hi Teja, about dontbunk: ')}`,
};

const LINK = 'font-bold text-link underline decoration-link/40 underline-offset-2 transition-[text-decoration-color,text-underline-offset] duration-150 hover:decoration-link hover:underline-offset-4';

export function MadeBy() {
  return (
    <div className="grid gap-1 font-term text-[13px] text-muted">
      <p className="m-0">
        Made by{' '}
        <a href={MAKER.url} target="_blank" rel="noopener noreferrer" className={LINK}>
          {MAKER.name}<span className="sr-only"> (opens LinkedIn in a new tab)</span>
        </a>
      </p>
      <p className="m-0">
        <a href={MAKER.whatsapp} target="_blank" rel="noopener noreferrer" className={LINK}>
          Found a problem?<span className="sr-only"> Message on WhatsApp (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
