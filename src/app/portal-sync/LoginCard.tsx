'use client';

import { useState } from 'react';
import { InfoTip } from '../InfoTip';

/** Sign-in form. The password goes straight to the portal via the server action and is never stored. */
export function LoginCard({ formAction, pending, error }: { formAction: (formData: FormData) => void; pending: boolean; error: string | null }) {
  const [rollNumber, setRollNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="card animate-rise p-5 phone:p-6">
      <p className="eyebrow-text m-0 mb-1 text-[12px] text-teal">CampX sign-in</p>
      <h1 className="heading m-0 mb-2 text-[26px] leading-[1.05]">Can I bunk?</h1>
      <p className="m-0 mb-5 flex gap-2 font-term text-[13px] leading-[1.5] text-muted">
        <span aria-hidden="true">🔒</span>
        <span>Sign in once. Your password goes straight to the portal and is never stored; you stay signed in on this device until you log out.</span>
      </p>

      <form action={formAction} className="grid gap-4">
        <div className="grid gap-1.5 font-term text-[13px] font-bold text-black">
          <span className="flex items-center gap-1.5">
            <label htmlFor="rollNumber">Roll number</label>
            <InfoTip label="About the roll number">Your college roll number, for example 24261A05A1. Letters are capitalised for you as you type.</InfoTip>
          </span>
          <input
            id="rollNumber"
            name="rollNumber"
            required
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            value={rollNumber}
            // Roll numbers follow ##261A##[A-Z]# — any letters typed in
            // lower case are normalized to upper case as you type.
            onChange={(event) => setRollNumber(event.target.value.toUpperCase())}
            className="field"
          />
        </div>
        <div className="grid gap-1.5 font-term text-[13px] font-bold text-black">
          <span className="flex items-center gap-1.5">
            <label htmlFor="password">CampX password</label>
            <InfoTip label="About the CampX password">The password you use to log in to the college portal (CampX), not a new one for dontbunk. It goes straight to the portal and is never stored. Only a sign-in token stays on this device until you log out.</InfoTip>
          </span>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              className="field pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 min-w-14 cursor-pointer font-term text-[12px] font-bold text-link"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="m-0 rounded-[var(--ui-radius-sm)] border border-error bg-danger-bg p-2.5 font-term text-[13px] font-bold text-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-calculate btn-calculate-hover">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
