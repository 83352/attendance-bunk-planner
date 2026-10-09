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

export type PortalSyncResult = {
  semesterSummary: PortalSemesterSummary;
  primaryAttendance: PortalPrimaryAttendance;
  dateWiseAttendance: PortalDateWiseAttendance;
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

/** Fetches everything dontbunk needs for one sync in a single logged-in session. */
export async function fetchPortalAttendance(
  rollNumber: string,
  password: string,
  semNo: number,
  month: number,
  year: number,
): Promise<{ ok: true; data: PortalSyncResult } | PortalLoginFailure> {
  return withPortalSession(rollNumber, password, async (session) => {
    const [semesterSummary, primaryAttendance, dateWiseAttendance] = await Promise.all([
      getJson<PortalSemesterSummary>(session, `/student-api/student-attendance/my-all-semester-attendance?semNo=${semNo}`),
      getJson<{ primaryAttendance: PortalPrimaryAttendance }>(session, `/student-api/student-attendance/my-secondary-attendance?semNo=${semNo}`)
        .then((body) => body.primaryAttendance),
      getJson<PortalDateWiseAttendance>(session, `/student-api/student-attendance/my-date-wise-attendance?semNo=${semNo}&month=${month}&year=${year}`),
    ]);
    return { semesterSummary, primaryAttendance, dateWiseAttendance };
  });
}
