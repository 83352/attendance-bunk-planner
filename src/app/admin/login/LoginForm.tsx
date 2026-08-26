'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured for this environment.');
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Sign-in failed. Check your credentials.');
      setBusy(false);
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return <form className="mt-7 grid max-w-[420px] gap-[18px]" onSubmit={submit}>
    <label className="grid gap-2 text-[10px] font-black leading-[1.1] text-black">Email<input className="min-h-[54px] w-full border-[3px] border-black bg-surface px-[13px] py-2 font-sans text-[18px] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="grid gap-2 text-[10px] font-black leading-[1.1] text-black">Password<input className="min-h-[54px] w-full border-[3px] border-black bg-surface px-[13px] py-2 font-sans text-[18px] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{error}</p>}
    <button className="btn-calculate btn-calculate-hover disabled:cursor-wait disabled:opacity-65" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <span aria-hidden="true">↗</span></button>
  </form>;
}
