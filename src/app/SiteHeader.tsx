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
    <header className="relative flex min-h-[47px] items-center justify-center border-b-[3px] border-[#111111] bg-[#111111] px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-[10px] text-[#f5f2e9] phone:min-h-[52px] phone:justify-start phone:px-[18px]">
      <Link onClick={handleClick} className="font-display text-[16px] leading-none font-black tracking-[0.75px] no-underline text-[#f5f2e9] phone:text-[17px]" href="/" aria-label="dontbunk home">
        dont<span className="text-[#b7f14a]">bunk</span>
      </Link>
      <span className="absolute right-6 rotate-45 text-[14px] text-lime phone:right-5" aria-hidden="true">◆</span>
    </header>
  );
}
