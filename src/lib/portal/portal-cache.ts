import { loadCurrentSemester, loadPortalData, loadSubjects, type CallTiming, type PortalSession, type PortalSubjectAttendance, type PortalSyncResult } from './campx-client';
import { createSessionCache, sessionKey } from './session-cache';

/**
 * Fewer calls to CampX, which is slow: per signed-in session, remember the
 * semester for half a day (saves a call on every load), the first screen's data
 * for two minutes (a reload is instant and costs CampX nothing), and the slow
 * per-subject summary for ten minutes. Each student's data is only ever served
 * back to the same session.
 */
const semesters = createSessionCache<number>({ ttlMs: 12 * 60 * 60 * 1000, maxEntries: 2000 });
const firstScreen = createSessionCache<PortalSyncResult>({ ttlMs: 2 * 60 * 1000, maxEntries: 200 });
const subjects = createSessionCache<PortalSubjectAttendance[]>({ ttlMs: 10 * 60 * 1000, maxEntries: 200 });

export function cachedPortalData(session: PortalSession, log: CallTiming[] = []): Promise<PortalSyncResult> {
  const key = sessionKey(session);
  return firstScreen.get(key, async () => loadPortalData(session, log, await semesters.get(key, () => loadCurrentSemester(session, log))));
}

export function cachedSubjects(session: PortalSession, semNo: number): Promise<PortalSubjectAttendance[]> {
  return subjects.get(`${sessionKey(session)}|${semNo}`, () => loadSubjects(session, semNo));
}

/** After a log-out or an expired session, so nothing of it lingers here. */
export function forgetSession(session: PortalSession): void {
  const key = sessionKey(session);
  semesters.delete(key);
  firstScreen.delete(key);
  subjects.delete(key);
}
