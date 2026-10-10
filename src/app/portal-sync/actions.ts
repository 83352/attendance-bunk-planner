'use server';

import { currentIstDate } from '@/domain/schedule/calendar';
import { fetchPortalAttendance, type PortalSyncResult } from '@/lib/portal/campx-client';

export type PortalSyncState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: PortalSyncResult };

/**
 * Logs in to the college portal with the credentials the student just typed,
 * pulls their attendance, and logs back out — all within this one request.
 * The password exists only for the lifetime of this call: it is never
 * written to a database, a log, a cookie, or returned to the client.
 */
export async function syncFromPortal(_: PortalSyncState, formData: FormData): Promise<PortalSyncState> {
  // Roll numbers follow ##261A##[A-Z]# — uppercased here too as a safety
  // net, in case this is ever called without the form's own live uppercasing.
  const rollNumber = String(formData.get('rollNumber') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');

  if (!rollNumber) return { status: 'error', message: 'Enter your roll number.' };
  if (!password) return { status: 'error', message: 'Enter your CampX password.' };

  const today = currentIstDate(new Date());
  const [year, month] = today.split('-').map(Number);

  // No semester field here — fetchPortalAttendance reads the student's real
  // current semester from the portal itself.
  const result = await fetchPortalAttendance(rollNumber, password, month, year);

  if (!result.ok) {
    switch (result.reason) {
      case 'wrong-password':
        return { status: 'error', message: 'Wrong password.' };
      case 'mfa-required':
        return { status: 'error', message: "Can't use with MFA." };
      case 'network-error':
        return { status: 'error', message: "Couldn't reach the portal. Try again in a moment." };
    }
  }

  return { status: 'success', data: result.data };
}
