import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="relative flex min-h-[47px] items-center justify-center border-b-[3px] border-[#111111] bg-[#111111] px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-[10px] text-[#f5f2e9] phone:min-h-[52px] phone:justify-start phone:px-[18px]">
      <Link className="font-display text-[16px] leading-none font-black tracking-[0.75px] no-underline text-[#f5f2e9] phone:text-[17px]" href="/" aria-label="dontbunk home">
        dont<span className="text-[#b7f14a]">bunk</span>
      </Link>
      <span className="absolute right-6 rotate-45 text-[14px] text-lime phone:right-5" aria-hidden="true">◆</span>
    </header>
  );
}
