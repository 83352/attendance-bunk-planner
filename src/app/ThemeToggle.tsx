'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  // SSR markup must be deterministic; the no-flash script fixes reality pre-paint.
  return 'light';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // Remember the choice for this tab so navigation keeps the theme.
    try { sessionStorage.setItem('dontbunk-theme', next); } catch {}
  }, [theme]);

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className="absolute right-11 top-1/2 -translate-y-[calc(50%-env(safe-area-inset-top)/2)] inline-flex cursor-pointer items-center gap-[5px] border-2 border-current bg-transparent px-[9px] py-[5px] font-term text-[11px] leading-none font-bold tracking-[.5px] hover:bg-lime hover:text-[#111111] phone:right-[42px]" onClick={toggle} aria-label={label} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? '\u263C LIGHT' : '\u263E DARK'}
    </button>
  );
}
