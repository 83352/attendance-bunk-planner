import type { ReactNode } from 'react';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[760px] px-5 pt-[26px] pb-14 phone:w-full phone:px-3.5 phone:pt-[22px] phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
