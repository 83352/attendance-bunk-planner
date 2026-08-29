import type { ReactNode } from 'react';
import { SiteHeader } from '../SiteHeader';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100vh-47px)] w-full max-w-[760px] px-5 pt-[26px] pb-14 phone:w-full phone:px-3.5 phone:pt-[22px] phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  );
}
