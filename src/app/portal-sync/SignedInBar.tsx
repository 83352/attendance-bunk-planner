'use client';

import { clearSavedAnswers } from '@/lib/portal/saved-answers';

/** Slim status row shown above the result: which semester, and the way out. */
export function SignedInBar({ semester, formAction, pending }: { semester: number; formAction: (formData: FormData) => void; pending: boolean }) {
  return (
    <form action={formAction} className="flex animate-rise flex-wrap items-center justify-between gap-3">
      <div>
        <p className="eyebrow-text m-0 text-[10px] text-teal">Semester {semester}</p>
        <h1 className="heading m-0 text-[22px] leading-[1.1]">Can I bunk?</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden font-term text-[11px] text-muted phone:inline">Signed in · password not stored</span>
        <button
          type="submit"
          name="intent"
          value="logout"
          disabled={pending}
          // Clear this device's saved answers too, so nothing is left behind on a shared computer.
          onClick={() => clearSavedAnswers()}
          className="chip"
        >
          Log out
        </button>
      </div>
    </form>
  );
}
