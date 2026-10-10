import { cookies } from 'next/headers';
import { currentIstDate } from '@/domain/schedule/calendar';
import { loadCalendarOverrides, yearOfSemester } from '@/lib/portal/calendar-overrides';
import { loadPortalData, PortalSessionExpiredError, type PortalSession } from '@/lib/portal/campx-client';
import type { PortalSyncState } from './actions';

/**
 * Keeps a student signed in between visits. What's stored is the portal's own
 * session token (never the password), in an httpOnly cookie in that student's
 * own browser: scripts on the page can't read it, and it only goes back to
 * this site's server. Logging out revokes it at the portal and deletes it.
 */
const COOKIE_NAME = 'dontbunk_portal';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readStoredSession(): Promise<PortalSession | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<PortalSession>;
    if (typeof parsed.cookie !== 'string' || (parsed.bearer !== null && typeof parsed.bearer !== 'string')) return null;
    return { cookie: parsed.cookie, bearer: parsed.bearer ?? null };
  } catch {
    return null;
  }
}

export async function storeSession(session: PortalSession): Promise<void> {
  (await cookies()).set(COOKIE_NAME, Buffer.from(JSON.stringify(session)).toString('base64url'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/portal-sync',
    maxAge: THIRTY_DAYS,
  });
}

export async function clearStoredSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_NAME, path: '/portal-sync' });
}

/** Everything the page shows, for an already-signed-in session. Never throws: failures come back as an error state. */
export async function loadSyncState(session: PortalSession): Promise<PortalSyncState> {
  const [year, month] = currentIstDate(new Date()).split('-').map(Number);
  try {
    const data = await loadPortalData(session, month, year);
    return { status: 'success', data, overrides: loadCalendarOverrides(yearOfSemester(data.currentSemNo)) };
  } catch (error) {
    if (error instanceof PortalSessionExpiredError) return { status: 'error', message: 'Your session expired. Sign in again.', sessionExpired: true };
    return { status: 'error', message: "Couldn't reach the portal. Try again in a moment." };
  }
}
