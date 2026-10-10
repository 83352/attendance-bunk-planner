import type { ExamPeriod } from '@/domain/schedule/types';

/**
 * FALLBACK ONLY — used when calendar-overrides.json has no entry for the
 * student's year (that file normally supplies exam dates).
 *
 * Manually maintained — the portal has no reliable way to tell an exam
 * session from a regular class. During an exam week, each subject's row in
 * `classroom-timetables` looks exactly like a normal class: same
 * `subjectType` ("Theory"/"Practical"), `isSuspended: false`, and the
 * `remarks` field ("Mid-1 Attendance") was only populated on 1 of 7 rows
 * checked for Mid 1 — not reliable enough to detect from alone. The only
 * real signal is the date falling in a known exam range, so that range has
 * to come from somewhere outside the portal.
 *
 * Update this file when a new exam's dates are announced. `periodsPerDay: 2`
 * matches what was observed for Mid 1 — every subject gets one 2-period
 * (2 hour) exam slot across the week.
 */
export const KNOWN_EXAM_PERIODS: ExamPeriod[] = [
  { name: 'Mid 1', start: '2026-08-31', end: '2026-09-05', periodsPerDay: 2 },
  // Mid 2: TODO — not yet announced on the portal. Add its date range here
  // once known. Until then, the result page says so explicitly rather than
  // guessing a date (see the Mid-2 gap check in PortalSyncForm).
];
