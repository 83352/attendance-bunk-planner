'use client';

import { useState } from 'react';
import { clearSavedAnswers } from '@/lib/portal/saved-answers';

/** Slim status row shown above the result: which semester, that you're signed in, and the way out (confirmed, since it clears saved answers). */
export function SignedInBar({ semester, formAction, pending }: { semester: number; formAction: (formData: FormData) => void; pending: boolean }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="grid animate-rise gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow-text m-0 text-[12px] text-teal">Semester {semester}</p>
          <h1 className="heading m-0 text-[22px] leading-[1.1]">Can I bunk?</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-term text-[13px] text-muted">
            <span aria-hidden="true" className="size-2 rounded-full bg-present" />
            Signed in
          </span>
          {!confirming && (
            <button type="button" onClick={() => setConfirming(true)} disabled={pending} className="chip">
              Log out
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="logout-question" className="card flex flex-wrap items-center justify-between gap-3 p-3">
          <p id="logout-question" className="m-0 text-[15px] leading-[1.4]">Log out? Your saved answers on this device will be cleared.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="chip">Cancel</button>
            <button
              type="submit"
              name="intent"
              value="logout"
              disabled={pending}
              // Clear this device's saved answers too, so nothing is left behind on a shared computer.
              onClick={() => clearSavedAnswers()}
              className="chip !border-error !text-error"
            >
              {pending ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
