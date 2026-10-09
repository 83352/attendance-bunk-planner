'use client';

import { useActionState, useState } from 'react';
import { syncFromPortal, type PortalSyncState } from './actions';

const initialState: PortalSyncState = { status: 'idle' };

/**
 * Phase-1 vertical slice: log in with portal credentials and show the raw
 * numbers back. This proves the whole path (form -> server action -> CampX
 * -> engine-ready counts) end to end. It is not yet wired into the real
 * Calculator card, and it does not yet remove the old manual-entry flow —
 * that replacement is the next step, once this path is confirmed working
 * against a real account.
 */
export function PortalSyncForm() {
  const [state, formAction, pending] = useActionState(syncFromPortal, initialState);
  const [rollNumber, setRollNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[480px] border-[3px] border-black bg-paper p-5 shadow-hard">
      <h1 className="m-0 mb-1 font-display text-[22px] font-black uppercase">Sync from portal</h1>
      <p className="m-0 mb-4 font-term text-[12px] text-muted">
        Your roll number and password are sent once, straight to the portal, to read your attendance. Nothing is stored.
      </p>
      <form action={formAction} className="grid gap-3">
        <label className="grid gap-1 font-term text-[12px] font-bold text-black">
          Roll number
          <input
            name="rollNumber"
            required
            value={rollNumber}
            // Roll numbers follow ##261A##[A-Z]# — any letters typed in
            // lower case are normalized to upper case as you type.
            onChange={(event) => setRollNumber(event.target.value.toUpperCase())}
            className="min-h-11 border-2 border-black bg-surface px-3 font-sans text-[15px]"
          />
        </label>
        <label className="grid gap-1 font-term text-[12px] font-bold text-black">
          CampX password
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="off"
              className="min-h-11 w-full border-2 border-black bg-surface px-3 pr-14 font-sans text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 min-w-11 cursor-pointer font-term text-[11px] font-bold text-link"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <label className="grid gap-1 font-term text-[12px] font-bold text-black">
          Semester number
          <input name="semNo" type="number" min="1" defaultValue="3" required className="min-h-11 border-2 border-black bg-surface px-3 font-sans text-[15px]" />
        </label>
        <button type="submit" disabled={pending} className="btn-calculate btn-calculate-hover">
          {pending ? 'Syncing…' : 'Sync'}
        </button>
      </form>

      {state.status === 'error' && (
        <p role="alert" className="mt-4 border-2 border-black bg-danger-bg p-2 font-term text-[12px] font-bold text-error">
          {state.message}
        </p>
      )}

      {state.status === 'success' && (
        <div className="mt-4 grid gap-2 font-term text-[12px]">
          <p className="m-0 font-bold">
            {state.data.primaryAttendance.present}/{state.data.primaryAttendance.numberOfClasses} held, {state.data.primaryAttendance.percentage}%
          </p>
          <ul className="m-0 grid gap-1 pl-5">
            {state.data.semesterSummary.subjects.map((subject) => (
              <li key={subject.subjectName}>{subject.subjectName}: {subject.present}/{subject.numberOfClasses} ({subject.percentage}%)</li>
            ))}
          </ul>
          <p className="m-0 text-muted">{Object.keys(state.data.dateWiseAttendance).length} days recorded this month.</p>
        </div>
      )}
    </div>
  );
}
