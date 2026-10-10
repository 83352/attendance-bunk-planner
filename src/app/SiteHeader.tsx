'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';

type SiteHeaderProps = {
  /**
   * Called when the user clicks the dontbunk logo. Return `true` to
   * prevent the default Link navigation (e.g. when the caller has already
   * reset the page state in-place). The Link still navigates to "/" by
   * default so right-click / cmd-click / assistive tech still work.
   */
  onHomeClick?: (event: MouseEvent<HTMLAnchorElement>) => boolean | void;
};

export function SiteHeader({ onHomeClick }: SiteHeaderProps = {}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onHomeClick) return;
    // Returning true from the callback skips the default Link navigation,
    // letting the caller reset state without leaving the current page.
    if (onHomeClick(event) === true) event.preventDefault();
  }
  return (
    <header className="relative flex min-h-[47px] items-center justify-start border-b-[length:var(--ui-border)] border-header-bg bg-header-bg px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-[10px] text-header-ink phone:min-h-[52px] phone:px-[18px]">
      <Link onClick={handleClick} className="heading -my-3 inline-flex min-h-11 items-center text-[16px] leading-none no-underline text-header-ink phone:text-[17px]" href="/" aria-label="dontbunk home">
        dont<span className="text-header-accent">bunk</span>
      </Link>
    </header>
  );
}
