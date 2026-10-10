import { SiteHeader } from '../SiteHeader';
import type { PortalSyncState } from './actions';
import { PortalSyncForm } from './PortalSyncForm';
import { loadSyncState, readStoredSession } from './session';

/** Signed-in visitors land straight on their result; everyone else gets the login form. */
export default async function PortalSyncPage() {
  const stored = await readStoredSession();
  const initialState: PortalSyncState = stored ? await loadSyncState(stored) : { status: 'idle' };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] px-4 py-6 phone:px-5 phone:py-8">
        <PortalSyncForm initialState={initialState} />
      </main>
    </>
  );
}
