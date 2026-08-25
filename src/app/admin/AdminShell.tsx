import type { ReactNode } from 'react';
import { ThemeToggle } from '../ThemeToggle';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
