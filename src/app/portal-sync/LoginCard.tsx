'use client';

import { useRef, useState, type FormEvent } from 'react';

/** Roll numbers look like 24261A05A1: 5 digits, a letter, 2 digits, then 2 letters or digits. */
const ROLL_NUMBER = /^\d{5}[A-Z]\d{2}[A-Z0-9]{2}$/;

type FieldErrors = { rollNumber?: string; password?: string };

/**
 * Sign-in form. The password is sent once, through this app's server action,
 * to CampX to get a sign-in token; it is never stored or logged.
 */
export function LoginCard({ formAction, pending, error, notice }: { formAction: (formData: FormData) => void; pending: boolean; error: string | null; /** e.g. "You're logged out" after Log out. */ notice?: string | null }) {
  const [rollNumber, setRollNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const why = useRef<HTMLDialogElement>(null);

  // Our own inline errors instead of the browser's bubbles (the form is noValidate).
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    const roll = String(form.get('rollNumber') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const next: FieldErrors = {};
    if (!roll) next.rollNumber = 'Enter your roll number.';
    else if (!ROLL_NUMBER.test(roll)) next.rollNumber = 'That doesn’t look like a roll number. It’s 10 characters, like 24261A05A1.';
    if (!password) next.password = 'Enter your CampX password.';
    setErrors(next);
    if (next.rollNumber || next.password) event.preventDefault();
  };

  return (
    <section className="card animate-rise p-5 phone:p-6">
      {notice && (
        <p role="status" className="m-0 mb-4 rounded-[var(--ui-radius-sm)] border border-present bg-present-bg p-2.5 text-[14px] font-bold text-present">
          {notice}
        </p>
      )}
      <p className="eyebrow-text m-0 mb-1 text-[12px] text-teal">CampX sign-in</p>
      <h1 className="heading m-0 mb-2 text-[26px] leading-[1.05]">Can I bunk?</h1>
      <p className="m-0 mb-5 text-[15px] leading-[1.5] text-muted">
        <span aria-hidden="true">🔒 </span>
        Sign in once with your CampX details. We never store your password, and you stay signed in on this device until you log out.{' '}
        <button type="button" onClick={() => why.current?.showModal()} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-link underline underline-offset-2">
          Why we need this?
        </button>
      </p>

      <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5 text-[14px] font-bold text-black">
          <label htmlFor="rollNumber">Roll number</label>
          <span id="rollNumberHint" className="-mt-1 font-term text-[13px] font-normal text-muted">e.g. 24261A05A1 · letters are capitalised for you</span>
          <input
            id="rollNumber"
            aria-describedby={errors.rollNumber ? 'rollNumberHint rollNumberError' : 'rollNumberHint'}
            aria-invalid={!!errors.rollNumber}
            name="rollNumber"
            required
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            value={rollNumber}
            onChange={(event) => {
              setRollNumber(event.target.value.toUpperCase());
              if (errors.rollNumber) setErrors((current) => ({ ...current, rollNumber: undefined }));
            }}
            className={`field ${errors.rollNumber ? 'input-error' : ''}`}
          />
          {errors.rollNumber && <span id="rollNumberError" role="alert" className="font-term text-[13px] text-error">{errors.rollNumber}</span>}
        </div>
        <div className="grid gap-1.5 text-[14px] font-bold text-black">
          <label htmlFor="password">CampX password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'passwordError' : undefined}
              onChange={() => { if (errors.password) setErrors((current) => ({ ...current, password: undefined })); }}
              className={`field pr-16 ${errors.password ? 'input-error' : ''}`}
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
          {errors.password && <span id="passwordError" role="alert" className="font-term text-[13px] text-error">{errors.password}</span>}
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

      <dialog
        ref={why}
        aria-labelledby="why-title"
        onClick={(event) => { if (event.target === why.current) why.current?.close(); }}
        className="m-auto w-[min(420px,calc(100vw-32px))] rounded-[var(--ui-radius)] border-[length:var(--ui-border)] border-edge bg-paper p-0 text-black shadow-hard backdrop:bg-black/60"
      >
        <div className="grid gap-3 p-5 text-[15px] leading-[1.55]">
          <h2 id="why-title" className="heading m-0 text-[20px]">Why we need your CampX password</h2>
          <p className="m-0">Your attendance and timetable live on CampX, and CampX only shows them to a signed-in student. So dontbunk signs in as you, once.</p>
          <p className="m-0">Your password is sent over HTTPS through dontbunk&rsquo;s server to CampX, just to get a sign-in token. It is never saved or logged.</p>
          <p className="m-0">Only that token is kept, in a cookie on this device. Log out revokes it at CampX and clears everything dontbunk saved here.</p>
          <p className="m-0 text-muted">dontbunk isn&rsquo;t run by CampX or your college. Accounts with two-step verification (MFA) aren&rsquo;t supported yet.</p>
          <button type="button" onClick={() => why.current?.close()} className="chip justify-self-end">Got it</button>
        </div>
      </dialog>
    </section>
  );
}
