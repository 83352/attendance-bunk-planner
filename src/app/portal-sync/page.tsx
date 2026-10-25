import { MadeBy } from '../MadeBy';
import { SITE_UNDER_MAINTENANCE } from '@/lib/maintenance';
import { SiteHeader } from '../SiteHeader';
import type { PortalSyncState } from './actions';
import { PortalSyncForm } from './PortalSyncForm';
import { loadSyncState, readStoredSession } from './session';

/** The per-subject summary can take the portal up to ~50 s, so allow the function that long. */
export const maxDuration = 60;

/** Signed-in visitors land straight on their result; everyone else gets the login form. */
export default async function PortalSyncPage() {
  // The layout shows the maintenance notice instead; don't touch the portal behind it.
  if (SITE_UNDER_MAINTENANCE) return null;
  const stored = await readStoredSession();
  const initialState: PortalSyncState = stored ? await loadSyncState(stored) : { status: 'idle' };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] px-4 py-6 phone:px-5 phone:py-8">
        <PortalSyncForm initialState={initialState} />
      </main>
      <footer className="mx-auto w-full max-w-[680px] px-4 pb-8 text-center phone:px-5">
        <MadeBy />
      </footer>
    </>
  );
}
