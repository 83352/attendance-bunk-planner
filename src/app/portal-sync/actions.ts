'use server';

import type { CalendarOverrides } from '@/lib/portal/calendar-overrides';
import { signIn, signOut, type PortalSyncResult } from '@/lib/portal/campx-client';
import { clearStoredSession, loadSyncState, readStoredSession, storeSession } from './session';

export type PortalSyncState =
  | { status: 'idle' }
  | { status: 'error'; message: string; /** The stored sign-in is no longer valid, so the form should be shown. */ sessionExpired?: boolean }
  | { status: 'success'; data: PortalSyncResult; overrides: CalendarOverrides | null };

/**
 * One action for the whole signed-in lifecycle, picked by the form's `intent`:
 *  - sign in (roll number + password): the password is used for exactly one
 *    request to the portal and is never stored, logged, or sent back. Only the
 *    portal's session token is kept, in an httpOnly cookie (see session.ts).
 *  - `logout`: revoke the session at the portal and delete the cookie.
 */
export async function syncFromPortal(_: PortalSyncState, formData: FormData): Promise<PortalSyncState> {
  const intent = String(formData.get('intent') ?? 'login');

  if (intent === 'logout') {
    const stored = await readStoredSession();
    if (stored) await signOut(stored);
    await clearStoredSession();
    return { status: 'idle' };
  }

  // Roll numbers follow ##261A##[A-Z]# — uppercased here too as a safety
  // net, in case this is ever called without the form's own live uppercasing.
  const rollNumber = String(formData.get('rollNumber') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');

  if (!rollNumber) return { status: 'error', message: 'Enter your roll number.' };
  if (!password) return { status: 'error', message: 'Enter your CampX password.' };

  const login = await signIn(rollNumber, password);
  if (!login.ok) {
    switch (login.reason) {
      case 'wrong-password':
        return { status: 'error', message: 'Wrong password.' };
      case 'mfa-required':
        return { status: 'error', message: "Can't use with MFA." };
      case 'network-error':
        return { status: 'error', message: "Couldn't reach the portal. Try again in a moment." };
    }
  }

  await storeSession(login.session);
  return loadSyncState(login.session);
}
