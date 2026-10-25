/**
 * A thin client for the CampX student portal's own (unofficial, undocumented)
 * API, confirmed against the real web client's own requests — field names
 * and values watched directly from the portal, not guessed. See
 * `scripts/portal-probe` notes in the project history for how this was found.
 *
 * Security policy, non-negotiable:
 *   - The password passed to `signIn()` is used for exactly one request and is
 *     never logged, stored, or echoed back in any error.
 *   - What we keep so a student stays signed in is the portal's own session
 *     token (never the password), and only in that student's own browser, as
 *     an httpOnly cookie set by the server action — see portal-sync/actions.ts.
 *     "Log out" revokes it at the portal and deletes the cookie.
 */

import { checkCurrentSemester, checkPrimaryAttendance, checkSemesterSummary, checkTimetableRows, PortalContractError } from './contract';

const API_BASE = 'https://api.campx.in';
// This client is specific to MGIT's CampX workspace, matching the rest of
// the app (BRANCH_GROUPS, section names, etc. are all MGIT-specific too).
const PLAIN_HEADERS = {
  'x-tenant-id': 'mgit',
  'x-institution-code': 'mgit',
  'x-platform-id': 'campx',
};

/**
 * Logs each portal call's status and duration (and the portal's rate-limit
 * headroom) to the server console, so slow, failing or throttled calls can be
 * seen. On in development; in production set PORTAL_TIMING_LOG=1. Never logs
 * credentials, tokens or response bodies.
 */
const LOG_TIMING = process.env.NODE_ENV !== 'production' || ['1', 'true'].includes((process.env.PORTAL_TIMING_LOG ?? '').trim().toLowerCase());

/** One portal call's outcome, shown in the Data check panel so a slow or failing call can be spotted from the browser. */
export type CallTiming = { label: string; status: number | 'failed'; ms: number };

/** The portal didn't answer within the time we're willing to wait. */
export class PortalSlowError extends Error {}

/** Every portal call gets a ceiling so one hung call can't hold a whole page; the heavy per-subject call is given longer (see loadSubjects). */
const DEFAULT_TIMEOUT_MS = 15_000;

async function timedFetch(label: string, url: string, init?: RequestInit, log?: CallTiming[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    log?.push({ label, status: res.status, ms: elapsed() });
    if (LOG_TIMING) console.log(`[campx] ${label} -> ${res.status} in ${elapsed()}ms (rate limit left: ${res.headers.get('x-ratelimit-remaining') ?? 'n/a'})`);
    return res;
  } catch (error) {
    log?.push({ label, status: 'failed', ms: elapsed() });
    if (LOG_TIMING) console.log(`[campx] ${label} FAILED after ${elapsed()}ms (${error instanceof Error ? error.name : 'error'})`);
    if (error instanceof Error && error.name === 'TimeoutError') throw new PortalSlowError(`${label} took longer than ${timeoutMs / 1000}s.`);
    throw error;
  }
}

export type PortalSubjectAttendance = {
  subjectName: string;
  numberOfClasses: number;
  present: number;
  absent: number;
  percentage: number;
};

export type PortalSemesterSummary = {
  currentSemNo: number;
  classAverage: number;
  overallAttendance: string;
  subjects: PortalSubjectAttendance[];
};

export type PortalPrimaryAttendance = {
  numberOfClasses: number;
  present: number;
  absent: number;
  totalSessionsIncludingActivity: number;
  percentage: number;
};


export type PortalLoginFailure =
  | { ok: false; reason: 'wrong-password' }
  | { ok: false; reason: 'mfa-required' }
  | { ok: false; reason: 'rate-limited' }
  | { ok: false; reason: 'portal-error' }
  | { ok: false; reason: 'network-error'; message: string };

/** What the portal hands back at login — enough to make further requests as the student, but not their password. */
export type PortalSession = { cookie: string; bearer: string | null; /** Who is signed in, kept with the session so it can be shown after a reload. */ rollNumber?: string };

/** The portal no longer accepts this session (expired, or logged out elsewhere). */
export class PortalSessionExpiredError extends Error {}

function cookiesFrom(headers: Headers): string {
  const raw = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  return raw.map((entry) => entry.split(';')[0]).join('; ');
}

function findToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const session = (body as Record<string, unknown>).session;
  if (session && typeof session === 'object' && typeof (session as Record<string, unknown>).token === 'string') {
    return (session as Record<string, unknown>).token as string;
  }
  return null;
}

function authHeaders(session: PortalSession): Record<string, string> {
  return {
    ...PLAIN_HEADERS,
    ...(session.cookie ? { Cookie: session.cookie } : {}),
    ...(session.bearer ? { Authorization: `Bearer ${session.bearer}` } : {}),
  };
}

export async function signIn(rollNumber: string, password: string, log?: CallTiming[]): Promise<{ ok: true; session: PortalSession } | PortalLoginFailure> {
  let res: Response;
  try {
    res = await timedFetch('POST login', `${API_BASE}/auth-server/auth-v2/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...PLAIN_HEADERS },
      // Shape confirmed by watching the real client's own login request.
      body: JSON.stringify({
        loginId: rollNumber,
        password,
        deviceType: 'browser',
        clientName: 'unknown',
        os: 'unknown',
        osVersion: 'unknown',
        latitude: null,
        longitude: null,
        tokenType: 'WEB',
        loginType: 'USER',
      }),
    }, log);
  } catch (err) {
    return { ok: false, reason: 'network-error', message: err instanceof Error ? err.message : 'Could not reach the portal.' };
  }

  // Only the statuses a bad login really produces count as a wrong password;
  // a throttle or an outage must not tell students their password is wrong.
  if (res.status === 429) return { ok: false, reason: 'rate-limited' };
  if (res.status >= 500) return { ok: false, reason: 'portal-error' };
  if (res.status >= 400) return { ok: false, reason: 'wrong-password' };

  let body: unknown = null;
  try { body = await res.json(); } catch { /* no body */ }

  const session: PortalSession = { cookie: cookiesFrom(res.headers), bearer: findToken(body) };

  if (body && typeof body === 'object' && (body as Record<string, unknown>).isMfaRequired) {
    // The portal still hands back a session here, but a second step (OTP
    // etc.) is needed before it's actually usable, which we don't support.
    await signOut(session);
    return { ok: false, reason: 'mfa-required' };
  }

  // A successful login that hands back nothing to sign later requests with means the login flow changed.
  if (!session.cookie && !session.bearer) throw new PortalContractError('login gave neither a session cookie nor a token');

  return { ok: true, session };
}

export async function signOut(session: PortalSession): Promise<void> {
  const headers = authHeaders(session);
  for (const path of ['/auth-server/auth-v2/logout', '/auth-server/auth/logout']) {
    try { await timedFetch(`POST ${path}`, `${API_BASE}${path}`, { method: 'POST', headers }); } catch { /* best-effort cleanup */ }
  }
}

/**
 * Fetches and validates one endpoint. `check` throws `PortalContractError` when
 * the response isn't the shape dontbunk was built for; an endpoint that has
 * gone (404/405/410) or a body that isn't JSON counts as the same thing.
 */
async function getJson<T>(session: PortalSession, path: string, check: (body: unknown) => T, log?: CallTiming[], timeoutMs?: number): Promise<T> {
  const res = await timedFetch(`GET ${path.split('?')[0]}`, `${API_BASE}${path}`, { headers: authHeaders(session) }, log, timeoutMs);
  if (res.status === 401 || res.status === 403) throw new PortalSessionExpiredError(`Portal rejected the session for ${path}.`);
  if (res.status === 404 || res.status === 405 || res.status === 410) throw new PortalContractError(`${path.split('?')[0]} no longer exists (status ${res.status})`);
  if (!res.ok) throw new Error(`Portal request to ${path} failed with status ${res.status}.`);
  let body: unknown;
  try { body = await res.json(); } catch { throw new PortalContractError(`${path.split('?')[0]} did not return JSON`); }
  return check(body);
}

/**
 * One row from `classroom-timetables` — this is the *classroom's* full
 * schedule, not the student's own: when two labs run at the same time for
 * two half-section batches, both rows are present here. `studentAttendance`
 * is how we tell which one is actually this student's (see
 * `resolveOwnSessions` below); it's confirmed only non-null on the row that
 * belongs to them, for any session that's already happened.
 */
type RawClassroomTimetableRow = {
  sessionDate: string; // YYYY-MM-DD
  fromTime: string; // HH:MM:SS
  toTime: string;
  periods: number[];
  semNo: number;
  isSuspended: boolean;
  completed: boolean;
  reason: string | null;
  remarks: string | null;
  subjectId: number;
  subject: { name: string; subjectCode: string };
  faculties: { fullName: string }[];
  groups: { id: number; name: string }[];
  timetableSlot: { day: string };
  /** `status: true` means ABSENT, `false` means PRESENT — inverted from what the name suggests. See `resolveOwnSessions`. */
  studentAttendance: { status: boolean } | null;
};

/** One class session, already resolved to this student (no other batch's concurrent lab). */
export type PortalTimetableSession = {
  date: string;
  day: string;
  fromTime: string;
  toTime: string;
  periods: number[];
  subjectName: string;
  subjectCode: string;
  facultyNames: string[];
  groupName: string | null;
  isSuspended: boolean;
  completed: boolean;
  /** Present/absent for this session, if the portal has already recorded it. */
  attended: boolean | null;
  /** Built from the admin's calendar patches, not read from the portal (see `patchedTimetable`). */
  synthetic?: boolean;
};

/**
 * Drops the "other half's" row wherever two sessions share a date and start
 * time (the split-lab case: half the section in one lab, half in another).
 * A subject is classified as "mine" if ANY of its sessions anywhere this
 * semester has a recorded `studentAttendance` — batch assignment is stable
 * for the whole semester, so one real record is enough to resolve the rest,
 * including sessions that haven't happened yet. If neither side of a pair
 * has happened yet (so there's no evidence either way), both are kept rather
 * than silently dropping one — that's the one case this can't resolve from
 * data alone.
 */
function resolveOwnSessions(rows: RawClassroomTimetableRow[]): PortalTimetableSession[] {
  const mineSubjectIds = new Set(rows.filter((r) => r.studentAttendance !== null).map((r) => r.subjectId));
  // Matched by NAME, not id: the portal gives each subject's lab its own
  // group ids ("BATCH 2" is 536 for one lab and 540 for another), so an id
  // learned from one lab says nothing about the next. The name is what repeats.
  const myGroupNames = new Set(rows.filter((r) => r.studentAttendance !== null).flatMap((r) => r.groups.map((g) => g.name)));

  const byKey = new Map<string, RawClassroomTimetableRow[]>();
  for (const row of rows) {
    const key = `${row.sessionDate}|${row.fromTime}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const toSession = (r: RawClassroomTimetableRow): PortalTimetableSession => ({
    date: r.sessionDate,
    day: r.timetableSlot.day,
    fromTime: r.fromTime,
    toTime: r.toTime,
    periods: r.periods,
    subjectName: r.subject.name,
    subjectCode: r.subject.subjectCode,
    facultyNames: r.faculties.map((f) => f.fullName),
    groupName: r.groups[0]?.name ?? null,
    isSuspended: r.isSuspended,
    completed: r.completed,
    // Counter-intuitive, verified against every subject's real present/total
    // counts: studentAttendance.status is true for an ABSENCE, false for a
    // PRESENT session — the opposite of what the name suggests.
    attended: r.studentAttendance ? !r.studentAttendance.status : null,
  });

  const result: PortalTimetableSession[] = [];
  for (const group of byKey.values()) {
    const distinctSubjects = new Set(group.map((r) => r.subjectId));
    if (distinctSubjects.size === 1) {
      result.push(...group.map(toSession));
      continue;
    }
    // Strongest evidence first: a recorded attendance on this very row. Then
    // batch (group) membership, which stays correct even when both labs are
    // "mine" at different times (batches swap labs week to week, so the
    // subject alone can't tell them apart). Subject is the last resort.
    const graded = group.filter((r) => r.studentAttendance !== null);
    const byGroup = group.filter((r) => r.groups.some((g) => myGroupNames.has(g.name)));
    const bySubject = group.filter((r) => mineSubjectIds.has(r.subjectId));
    const resolved = [graded, byGroup, bySubject].find((candidates) => candidates.length > 0 && candidates.length < group.length);
    result.push(...(resolved ?? group).map(toSession));
  }
  return result.sort((a, b) => (a.date + a.fromTime).localeCompare(b.date + b.fromTime));
}

export type PortalSyncResult = {
  /** The student's actual current semester, read from the portal — never guessed or hand-typed. */
  currentSemNo: number;
  primaryAttendance: PortalPrimaryAttendance;
  /** This semester's sessions only, already resolved to this student (see resolveOwnSessions). */
  timetable: PortalTimetableSession[];
  /** How long each portal call took on the server, in the order they finished (for the Data check panel). */
  callTimings: CallTiming[];
};

/**
 * The student's current semester. Never asked for or guessed:
 * `my-all-semester-attendance` reports the real `currentSemNo` regardless of
 * which semNo the query asks for, so a cheap call (semNo=1, which always exists)
 * finds it.
 */
export async function loadCurrentSemester(session: PortalSession, log: CallTiming[] = []): Promise<number> {
  const probe = await getJson(session, '/student-api/student-attendance/my-all-semester-attendance?semNo=1', (body) => checkCurrentSemester(body), log);
  return probe.currentSemNo;
}

/**
 * Fetches what the result needs, using an already-signed-in session (throws
 * `PortalSessionExpiredError` if the portal rejects it, `PortalSlowError` if it
 * doesn't answer in time). Pass `semNo` when it's already known to skip the
 * lookup (see portal-cache.ts). The heavy per-subject summary and the day-by-day
 * attendance are deliberately not fetched here: they were by far the slowest
 * calls and nothing on the first screen needs them (see `loadSubjects`).
 */
export async function loadPortalData(session: PortalSession, log: CallTiming[] = [], knownSemNo?: number): Promise<PortalSyncResult> {
  const semNo = knownSemNo ?? (await loadCurrentSemester(session, log));

  const [primaryAttendance, timetableRows] = await Promise.all([
    getJson(session, `/student-api/student-attendance/my-secondary-attendance?semNo=${semNo}`, (body) => checkPrimaryAttendance(body), log),
    // The classroom's full multi-semester timetable in one call, filtered
    // to this semester, then resolved down to this student's own sessions.
    getJson(session, '/student-api/classroom-timetables', (body) => checkTimetableRows(body) as RawClassroomTimetableRow[], log),
  ]);

  const timetable = resolveOwnSessions(timetableRows.filter((row) => row.semNo === semNo));

  return { currentSemNo: semNo, primaryAttendance, timetable, callTimings: log };
}

/** Longest we wait for the per-subject summary: it has been taking 30-90 s on the portal's side. */
const SUBJECTS_TIMEOUT_MS = 50_000;

/** Per-subject attendance for the semester. Slow on the portal's side, so it's loaded on demand, never with the first screen. */
export async function loadSubjects(session: PortalSession, semNo: number, log: CallTiming[] = []): Promise<PortalSubjectAttendance[]> {
  const summary = await getJson(session, `/student-api/student-attendance/my-all-semester-attendance?semNo=${semNo}`, (body) => checkSemesterSummary(body), log, SUBJECTS_TIMEOUT_MS);
  return summary.subjects;
}
