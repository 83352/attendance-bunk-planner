'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return <button className="border-2 border-black bg-paper px-3 py-2 font-term text-[10px] font-black uppercase text-black shadow-[2px_2px_0_var(--shadow-color)] disabled:cursor-wait disabled:opacity-60" type="button" onClick={logout} disabled={busy}>{busy ? 'Signing out...' : 'Sign out'}</button>;
}
