'use server';

import { headers } from 'next/headers';
import { SITE_UNDER_MAINTENANCE } from '@/lib/maintenance';
import { PortalContractError } from '@/lib/portal/contract';
import type { CalendarOverrides } from '@/lib/portal/calendar-overrides';
import { cachedSubjects, forgetSession } from '@/lib/portal/portal-cache';
import { PortalSessionExpiredError, PortalSlowError, signIn, signOut, type CallTiming, type PortalSubjectAttendance, type PortalSyncResult } from '@/lib/portal/campx-client';
import { createRateLimiter } from './rate-limit';
import { clearStoredSession, loadSyncState, readStoredSession, storeSession } from './session';

// Failed sign-ins only: five wrong passwords for one roll number, or twenty
// from one address, pause further attempts for 15 minutes (see rate-limit.ts).
const WINDOW_MS = 15 * 60 * 1000;
const byRollNumber = createRateLimiter({ max: 5, windowMs: WINDOW_MS });
const byAddress = createRateLimiter({ max: 20, windowMs: WINDOW_MS });

const waitMessage = (seconds: number) => `Too many failed sign-ins. Try again in ${Math.ceil(seconds / 60)} ${Math.ceil(seconds / 60) === 1 ? 'minute' : 'minutes'}.`;

export type PortalSyncState =
  | { status: 'idle'; /** Shown above the sign-in form, e.g. after logging out. */ notice?: string }
  /** The portal no longer answers the way dontbunk expects (see contract.ts): the whole site is blocked until it is fixed. */
  | { status: 'maintenance' }
  | { status: 'error'; message: string; /** Which portal calls ran and how long each took, shown under the error when something was slow or failed. */ timings?: CallTiming[]; /** The stored sign-in is no longer valid, so the form should be shown. */ sessionExpired?: boolean }
  | { status: 'success'; data: PortalSyncResult; overrides: CalendarOverrides | null; /** The signed-in student's roll number, if known. */ rollNumber: string | null };

/**
 * One action for the whole signed-in lifecycle, picked by the form's `intent`:
 *  - sign in (roll number + password): the password is used for exactly one
 *    request to the portal and is never stored, logged, or sent back. Only the
 *    portal's session token is kept, in an httpOnly cookie (see session.ts).
 *  - `logout`: revoke the session at the portal and delete the cookie.
 */
export async function syncFromPortal(_: PortalSyncState, formData: FormData): Promise<PortalSyncState> {
  if (SITE_UNDER_MAINTENANCE) return { status: 'maintenance' };
  const intent = String(formData.get('intent') ?? 'login');

  if (intent === 'logout') {
    const stored = await readStoredSession();
    if (stored) {
      forgetSession(stored);
      await signOut(stored);
    }
    await clearStoredSession();
    return { status: 'idle', notice: 'You’re logged out. Your saved answers were cleared from this device.' };
  }

  // Roll numbers follow ##261A##[A-Z]# — uppercased here too as a safety
  // net, in case this is ever called without the form's own live uppercasing.
  const rollNumber = String(formData.get('rollNumber') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');

  if (!rollNumber) return { status: 'error', message: 'Enter your roll number.' };
  if (!password) return { status: 'error', message: 'Enter your CampX password.' };

  const address = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const wait = Math.max(byRollNumber.retryAfter(rollNumber), byAddress.retryAfter(address));
  if (wait > 0) return { status: 'error', message: waitMessage(wait) };

  const log: CallTiming[] = [];
  let login: Awaited<ReturnType<typeof signIn>>;
  try {
    login = await signIn(rollNumber, password, log);
  } catch (error) {
    if (error instanceof PortalContractError) {
      console.error(`[portal] contract check failed: ${error.message}`);
      return { status: 'maintenance' };
    }
    throw error;
  }
  if (!login.ok) {
    switch (login.reason) {
      case 'wrong-password':
        byRollNumber.fail(rollNumber);
        byAddress.fail(address);
        return { status: 'error', message: 'Wrong roll number or password.' };
      case 'rate-limited':
        return { status: 'error', message: 'CampX is limiting sign-ins right now. Wait a few minutes and try again.' };
      case 'portal-error':
        return { status: 'error', message: 'CampX is having trouble right now. Try again in a few minutes.' };
      case 'mfa-required':
        return { status: 'error', message: "This account has two-step verification (MFA) turned on. dontbunk doesn't support MFA accounts yet." };
      case 'network-error':
        return { status: 'error', message: "Couldn't reach the portal. Try again in a moment." };
    }
  }

  byRollNumber.clear(rollNumber);
  // If it can't be stored (no SESSION_SECRET), sign-in still works for this visit; they'll just be asked again next time.
  const session = { ...login.session, rollNumber };
  await storeSession(session);
  return loadSyncState(session, log);
}

export type SubjectsState =
  | { status: 'ready'; subjects: PortalSubjectAttendance[] }
  | { status: 'slow' }
  /** `no-cookie`: this server never got the stored sign-in back; otherwise CampX itself refused the session. */
  | { status: 'expired'; why: 'no-cookie' | 'rejected' }
  | { status: 'maintenance' }
  | { status: 'error' };

/** Loads the per-subject summary on demand, with the signed-in student's stored session. */
export async function fetchSubjects(semNo: number): Promise<SubjectsState> {
  if (SITE_UNDER_MAINTENANCE) return { status: 'maintenance' };
  const stored = await readStoredSession();
  if (!stored) {
    console.error('[portal] subjects: no readable sign-in cookie (SESSION_SECRET unset or changed, or the browser did not send it).');
    return { status: 'expired', why: 'no-cookie' };
  }
  try {
    return { status: 'ready', subjects: await cachedSubjects(stored, semNo) };
  } catch (error) {
    if (error instanceof PortalSlowError) return { status: 'slow' };
    if (error instanceof PortalSessionExpiredError) {
      console.error('[portal] subjects: CampX rejected the session.');
      forgetSession(stored);
      await clearStoredSession();
      return { status: 'expired', why: 'rejected' };
    }
    if (error instanceof PortalContractError) {
      console.error(`[portal] contract check failed: ${error.message}`);
      return { status: 'maintenance' };
    }
    return { status: 'error' };
  }
}
