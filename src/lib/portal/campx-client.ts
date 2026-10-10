/**
 * A thin client for the CampX student portal's own (unofficial, undocumented)
 * API, confirmed against the real web client's own requests — field names
 * and values watched directly from the portal, not guessed. See
 * `scripts/portal-probe` notes in the project history for how this was found.
 *
 * Security policy, non-negotiable:
 *   - The password passed to `login()` is used for exactly one request and is
 *     never logged, stored, or echoed back in any error.
 *   - Nothing from the portal session (cookies, tokens) is persisted beyond
 *     the lifetime of a single sync — see `withPortalSession()`.
 *   - Every sync logs the session back out when it's done, success or not.
 */

const API_BASE = 'https://api.campx.in';
// This client is specific to MGIT's CampX workspace, matching the rest of
// the app (BRANCH_GROUPS, section names, etc. are all MGIT-specific too).
const PLAIN_HEADERS = {
  'x-tenant-id': 'mgit',
  'x-institution-code': 'mgit',
  'x-platform-id': 'campx',
};

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

/** Date (YYYY-MM-DD) -> the portal's own status string for that day, e.g. "PRESENT" | "ABSENT" | "PARTIALLY_PRESENT". */
export type PortalDateWiseAttendance = Record<string, string>;

export type PortalLoginFailure =
  | { ok: false; reason: 'wrong-password' }
  | { ok: false; reason: 'mfa-required' }
  | { ok: false; reason: 'network-error'; message: string };

type PortalSession = { cookie: string; bearer: string | null };

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

async function login(rollNumber: string, password: string): Promise<{ ok: true; session: PortalSession } | PortalLoginFailure> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth-server/auth-v2/login`, {
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
    });
  } catch (err) {
    return { ok: false, reason: 'network-error', message: err instanceof Error ? err.message : 'Could not reach the portal.' };
  }

  if (res.status >= 400) return { ok: false, reason: 'wrong-password' };

  let body: unknown = null;
  try { body = await res.json(); } catch { /* no body */ }

  const session: PortalSession = { cookie: cookiesFrom(res.headers), bearer: findToken(body) };

  if (body && typeof body === 'object' && (body as Record<string, unknown>).isMfaRequired) {
    // The portal still hands back a session here, but a second step (OTP
    // etc.) is needed before it's actually usable, which we don't support.
    await logout(session);
    return { ok: false, reason: 'mfa-required' };
  }

  return { ok: true, session };
}

async function logout(session: PortalSession): Promise<void> {
  const headers = authHeaders(session);
  for (const path of ['/auth-server/auth-v2/logout', '/auth-server/auth/logout']) {
    try { await fetch(`${API_BASE}${path}`, { method: 'POST', headers }); } catch { /* best-effort cleanup */ }
  }
}

async function getJson<T>(session: PortalSession, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(session) });
  if (!res.ok) throw new Error(`Portal request to ${path} failed with status ${res.status}.`);
  return res.json() as Promise<T>;
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
  semesterSummary: PortalSemesterSummary;
  primaryAttendance: PortalPrimaryAttendance;
  dateWiseAttendance: PortalDateWiseAttendance;
  /** This semester's sessions only, already resolved to this student (see resolveOwnSessions). */
  timetable: PortalTimetableSession[];
};

/**
 * Logs in, runs `withSession`, and always logs out afterward — whether
 * `withSession` throws or returns normally. The password only ever lives in
 * the one `login()` call's request body; nothing from the result of
 * `withSession` is retained by this function beyond returning it to the
 * caller, who decides what (if anything) to keep.
 */
export async function withPortalSession<T>(
  rollNumber: string,
  password: string,
  withSession: (session: PortalSession) => Promise<T>,
): Promise<{ ok: true; data: T } | PortalLoginFailure> {
  const loginResult = await login(rollNumber, password);
  if (!loginResult.ok) return loginResult;

  try {
    const data = await withSession(loginResult.session);
    return { ok: true, data };
  } finally {
    await logout(loginResult.session);
  }
}

/**
 * Fetches everything dontbunk needs for one sync in a single logged-in
 * session. The semester is never asked for or guessed: `my-all-semester-attendance`
 * reports the student's real `currentSemNo` regardless of which semNo the
 * query itself asks for, so a cheap throwaway call (semNo=1, which always
 * exists) finds it, and every real call afterward uses that.
 */
export async function fetchPortalAttendance(
  rollNumber: string,
  password: string,
  month: number,
  year: number,
): Promise<{ ok: true; data: PortalSyncResult } | PortalLoginFailure> {
  return withPortalSession(rollNumber, password, async (session) => {
    const probe = await getJson<PortalSemesterSummary>(session, '/student-api/student-attendance/my-all-semester-attendance?semNo=1');
    const semNo = probe.currentSemNo;

    const [semesterSummary, primaryAttendance, dateWiseAttendance, timetableRows] = await Promise.all([
      semNo === 1 ? Promise.resolve(probe) : getJson<PortalSemesterSummary>(session, `/student-api/student-attendance/my-all-semester-attendance?semNo=${semNo}`),
      getJson<{ primaryAttendance: PortalPrimaryAttendance }>(session, `/student-api/student-attendance/my-secondary-attendance?semNo=${semNo}`)
        .then((body) => body.primaryAttendance),
      getJson<PortalDateWiseAttendance>(session, `/student-api/student-attendance/my-date-wise-attendance?semNo=${semNo}&month=${month}&year=${year}`),
      // The classroom's full multi-semester timetable in one call — filtered
      // to this semester, then resolved down to this student's own sessions.
      getJson<RawClassroomTimetableRow[]>(session, '/student-api/classroom-timetables'),
    ]);

    const timetable = resolveOwnSessions(timetableRows.filter((row) => row.semNo === semNo));

    return { currentSemNo: semNo, semesterSummary, primaryAttendance, dateWiseAttendance, timetable };
  });
}
