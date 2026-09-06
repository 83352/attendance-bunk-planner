import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The admin sign-in and control-room pages have no reason to be publicly
// indexed or listed in search results. Title/description are unchanged and
// still inherited from the root layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
