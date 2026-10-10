'use client';

import { useActionState } from 'react';
import { syncFromPortal, type PortalSyncState } from './actions';
import { LoginCard } from './LoginCard';
import { SignedInBar } from './SignedInBar';
import { SyncedResult } from './SyncedResult';

/**
 * Signs in once with portal credentials (the page then keeps you signed in, so
 * later visits open straight onto the result). Once signed in, everything is
 * computed from what the portal already knows — see SyncedResult.
 */
export function PortalSyncForm({ initialState }: { initialState: PortalSyncState }) {
  const [state, formAction, pending] = useActionState(syncFromPortal, initialState);

  if (state.status !== 'success') {
    return <LoginCard formAction={formAction} pending={pending} error={state.status === 'error' ? state.message : null} />;
  }

  return (
    <div className="grid gap-5">
      <SignedInBar semester={state.data.currentSemNo} formAction={formAction} pending={pending} />
      <SyncedResult
        key={`${state.data.primaryAttendance.numberOfClasses}-${state.data.primaryAttendance.present}-${state.data.timetable.length}`}
        data={state.data}
        overrides={state.overrides}
      />
    </div>
  );
}
