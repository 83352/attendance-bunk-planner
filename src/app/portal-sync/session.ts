import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { cookies } from 'next/headers';
import { loadCalendarOverrides, yearOfSemester } from '@/lib/portal/calendar-overrides';
import { PortalContractError } from '@/lib/portal/contract';
import { PortalSessionExpiredError, PortalSlowError, type CallTiming, type PortalSession } from '@/lib/portal/campx-client';
import { cachedPortalData, forgetSession } from '@/lib/portal/portal-cache';
import type { PortalSyncState } from './actions';

/**
 * Keeps a student signed in between visits. What's stored is the portal's own
 * session token (never the password), in an httpOnly cookie in that student's
 * own browser: scripts on the page can't read it, and it only goes back to
 * this site's server. Logging out revokes it at the portal and deletes it.
 *
 * The cookie value is encrypted (AES-256-GCM, key from SESSION_SECRET), so the
 * portal token isn't readable from the cookie itself, and any tampering makes
 * it fail to decrypt and the student is simply asked to sign in again.
 */
const COOKIE_NAME = 'dontbunk_portal';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Browsers silently drop a cookie over about 4 KB, and the portal's session
 * can be that big once encrypted, so the value is compressed and split across
 * several cookies (`dontbunk_portal.0`, `.1`, …) of at most this many characters.
 */
const CHUNK_SIZE = 3000;
const chunkName = (index: number) => `${COOKIE_NAME}.${index}`;

export function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let at = 0; at < value.length; at += CHUNK_SIZE) chunks.push(value.slice(at, at + CHUNK_SIZE));
  return chunks;
}

/** Without SESSION_SECRET nothing is stored in production, so a misconfigured deploy fails loudly instead of leaving tokens unprotected. */
function encryptionKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === 'production' ? null : 'dontbunk-local-development-secret');
  return secret ? createHash('sha256').update(secret).digest() : null;
}

export function encryptSession(session: PortalSession, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(deflateRawSync(JSON.stringify(session))), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/** `null` for anything that isn't a cookie we wrote with this key: wrong key, tampered, truncated, or the old unencrypted format. */
export function decryptSession(raw: string, key: Buffer): PortalSession | null {
  try {
    const bytes = Buffer.from(raw, 'base64url');
    if (bytes.length < 28) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const json = inflateRawSync(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()])).toString('utf8');
    const parsed = JSON.parse(json) as Partial<PortalSession>;
    if (typeof parsed.cookie !== 'string' || (parsed.bearer !== null && typeof parsed.bearer !== 'string')) return null;
    return { cookie: parsed.cookie, bearer: parsed.bearer ?? null, ...(typeof parsed.rollNumber === 'string' ? { rollNumber: parsed.rollNumber } : {}) };
  } catch {
    return null;
  }
}

export async function readStoredSession(): Promise<PortalSession | null> {
  const key = encryptionKey();
  if (!key) return null;
  const store = await cookies();
  let raw = '';
  for (let index = 0; ; index++) {
    const chunk = store.get(chunkName(index))?.value;
    if (chunk === undefined) break;
    raw += chunk;
  }
  return raw ? decryptSession(raw, key) : null;
}

/** Returns false when the session couldn't be stored (no SESSION_SECRET in production); the student then stays signed in for this visit only. */
export async function storeSession(session: PortalSession): Promise<boolean> {
  const key = encryptionKey();
  if (!key) {
    console.error('[session] SESSION_SECRET is not set, so the sign-in was not stored.');
    return false;
  }
  await clearStoredSession();
  const store = await cookies();
  const chunks = splitIntoChunks(encryptSession(session, key));
  chunks.forEach((chunk, index) => {
    store.set(chunkName(index), chunk, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/portal-sync',
      maxAge: THIRTY_DAYS,
    });
  });
  // Sizes only, never the value.
  console.log(`[session] stored sign-in in ${chunks.length} cookie(s), ${chunks.reduce((sum, chunk) => sum + chunk.length, 0)} characters`);
  return true;
}

/** Deletes every chunk, and the single cookie older versions used. */
export async function clearStoredSession(): Promise<void> {
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (name === COOKIE_NAME || name.startsWith(`${COOKIE_NAME}.`)) store.delete({ name, path: '/portal-sync' });
  }
}

/** Everything the page shows, for an already-signed-in session. Never throws: failures come back as an error state. */
export async function loadSyncState(session: PortalSession, log: CallTiming[] = []): Promise<PortalSyncState> {
  try {
    const data = await cachedPortalData(session, log);
    return { status: 'success', data, overrides: loadCalendarOverrides(yearOfSemester(data.currentSemNo)), rollNumber: session.rollNumber ?? null };
  } catch (error) {
    if (error instanceof PortalContractError) {
      // Names the endpoint and field only, never any of the student's data.
      console.error(`[portal] contract check failed: ${error.message}`);
      return { status: 'maintenance' };
    }
    if (error instanceof PortalSlowError) return { status: 'error', message: 'CampX is taking too long to answer right now. Try again in a minute.', timings: log };
    if (error instanceof PortalSessionExpiredError) {
      forgetSession(session);
      return { status: 'error', message: 'Your session expired. Sign in again.', sessionExpired: true };
    }
    return { status: 'error', message: "Couldn't reach the portal. Try again in a moment.", timings: log };
  }
}
