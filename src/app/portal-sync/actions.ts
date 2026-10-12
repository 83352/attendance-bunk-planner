'use server';

import type { CalendarOverrides } from '@/lib/portal/calendar-overrides';
import { loadSubjects, PortalSessionExpiredError, PortalSlowError, signIn, signOut, type CallTiming, type PortalSubjectAttendance, type PortalSyncResult } from '@/lib/portal/campx-client';
import { clearStoredSession, loadSyncState, readStoredSession, storeSession } from './session';

export type PortalSyncState =
  | { status: 'idle'; /** Shown above the sign-in form, e.g. after logging out. */ notice?: string }
  | { status: 'error'; message: string; /** Which portal calls ran and how long each took, shown under the error when something was slow or failed. */ timings?: CallTiming[]; /** The stored sign-in is no longer valid, so the form should be shown. */ sessionExpired?: boolean }
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
    return { status: 'idle', notice: 'You’re logged out. Your saved answers were cleared from this device.' };
  }

  // Roll numbers follow ##261A##[A-Z]# — uppercased here too as a safety
  // net, in case this is ever called without the form's own live uppercasing.
  const rollNumber = String(formData.get('rollNumber') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');

  if (!rollNumber) return { status: 'error', message: 'Enter your roll number.' };
  if (!password) return { status: 'error', message: 'Enter your CampX password.' };

  const log: CallTiming[] = [];
  const login = await signIn(rollNumber, password, log);
  if (!login.ok) {
    switch (login.reason) {
      case 'wrong-password':
        return { status: 'error', message: 'Wrong roll number or password.' };
      case 'mfa-required':
        return { status: 'error', message: "This account has two-step verification (MFA) turned on. dontbunk doesn't support MFA accounts yet." };
      case 'network-error':
        return { status: 'error', message: "Couldn't reach the portal. Try again in a moment." };
    }
  }

  await storeSession(login.session);
  return loadSyncState(login.session, log);
}

export type SubjectsState =
  | { status: 'ready'; subjects: PortalSubjectAttendance[] }
  | { status: 'slow' }
  | { status: 'expired' }
  | { status: 'error' };

/** Loads the per-subject summary on demand, with the signed-in student's stored session. */
export async function fetchSubjects(semNo: number): Promise<SubjectsState> {
  const stored = await readStoredSession();
  if (!stored) return { status: 'expired' };
  try {
    return { status: 'ready', subjects: await loadSubjects(stored, semNo) };
  } catch (error) {
    if (error instanceof PortalSlowError) return { status: 'slow' };
    if (error instanceof PortalSessionExpiredError) return { status: 'expired' };
    return { status: 'error' };
  }
}
