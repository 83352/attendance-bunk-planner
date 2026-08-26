import type { ReactNode } from 'react';
import { ThemeToggle } from '../ThemeToggle';

// The admin topbar toggle sits in normal flow (unlike the fixed header one).
function ThemeToggleStatic() {
  return <div className="[&>button]:!static [&>button]:translate-y-0 [&>button]:text-muted [&>button]:hover:bg-lime [&>button]:hover:text-[#111111]">
    <ThemeToggle />
  </div>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[760px] px-5 pt-[26px] pb-14 phone:w-full phone:px-3.5 phone:pt-[22px] phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
      <div className="mb-1 flex justify-end">
        <ThemeToggleStatic />
      </div>
      {children}
    </main>
  );
}
