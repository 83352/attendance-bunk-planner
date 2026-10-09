import { SiteHeader } from '../SiteHeader';
import { PortalSyncForm } from './PortalSyncForm';

/** Temporary standalone page for testing the portal-sync vertical slice during the rebuild. */
export default function PortalSyncPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] px-5 py-8 phone:px-3">
        <PortalSyncForm />
      </main>
    </>
  );
}
