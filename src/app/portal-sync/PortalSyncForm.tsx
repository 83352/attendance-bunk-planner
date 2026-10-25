'use client';

import { useActionState, useState } from 'react';
import { actionFailureMessage } from '@/lib/action-errors';
import { syncFromPortal, type PortalSyncState } from './actions';
import { LoginCard } from './LoginCard';
import { MaintenanceNotice } from './MaintenanceNotice';
import { SignedInBar } from './SignedInBar';
import { SyncedResult } from './SyncedResult';

/**
 * Signs in once with portal credentials (the page then keeps you signed in, so
 * later visits open straight onto the result). Once signed in, everything is
 * computed from what the portal already knows — see SyncedResult.
 */
export function PortalSyncForm({ initialState }: { initialState: PortalSyncState }) {
  const [state, formAction, pending] = useActionState(async (previous: PortalSyncState, formData: FormData): Promise<PortalSyncState> => {
    // A failed call (a tab from before a deploy, a dropped connection) becomes a message on the form instead of the error page.
    try {
      return await syncFromPortal(previous, formData);
    } catch (error) {
      return { status: 'error', message: actionFailureMessage(error) };
    }
  }, initialState);
  // Raised by something loaded later (the subjects list). Tied to the state it
  // happened in, so signing in again (a new state) clears it.
  const [lateIssue, setLateIssue] = useState<{ during: PortalSyncState; kind: 'no-cookie' | 'rejected' | 'maintenance' } | null>(null);
  const late = lateIssue?.during === state ? lateIssue.kind : null;

  if (state.status === 'maintenance' || late === 'maintenance') return <MaintenanceNotice />;

  if (state.status !== 'success' || late) {
    const error = late === 'rejected' ? 'CampX ended your session. Sign in again.'
      : late === 'no-cookie' ? 'dontbunk couldn’t find your sign-in on this device, so it asked you to sign in again. If this keeps happening, tell the developer.'
      : state.status === 'error' ? state.message : null;
    return <LoginCard formAction={formAction} pending={pending} error={error} timings={state.status === 'error' ? state.timings : undefined} notice={state.status === 'idle' ? state.notice : null} />;
  }

  return (
    <div className="grid gap-5">
      <SignedInBar semester={state.data.currentSemNo} rollNumber={state.rollNumber} formAction={formAction} pending={pending} />
      <SyncedResult
        key={`${state.data.primaryAttendance.numberOfClasses}-${state.data.primaryAttendance.present}-${state.data.timetable.length}`}
        data={state.data}
        overrides={state.overrides}
        onLateIssue={(kind) => setLateIssue({ during: state, kind })}
      />
    </div>
  );
}
