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

  return <form className="admin-form" onSubmit={submit}>
    <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="calculate" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <span aria-hidden="true">↗</span></button>
  </form>;
}
