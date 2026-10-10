import type { CalculationRequest } from '@/domain/attendance/types';
import { currentIstDate } from '@/domain/schedule/calendar';
import type { DatedPeriod, Weekday } from '@/domain/schedule/types';
import { KNOWN_EXAM_PERIODS } from './exam-schedule';
import type { PortalSyncResult, PortalTimetableSession } from './campx-client';

/** Past/today sessions the portal hasn't graded yet — the student needs to answer these before a number can be computed. */
export function findUngradedPastSessions(data: PortalSyncResult, now: Date): PortalTimetableSession[] {
  const today = currentIstDate(now);
  return data.timetable.filter((session) => session.date <= today && !session.isSuspended && session.attended === null);
}

/** What the student answered for each ungraded past session (counts, not a per-session map — that's all the engine needs). */
export type PastOverrides = { attended: number; bunked: number };

/**
 * Builds the engine's input straight from synced portal data — no admin
 * timetable involved for regular classes. `pastOverrides` comes from
 * answers to `findUngradedPastSessions` (see PortalSyncForm); pass
 * `{ attended: 0, bunked: 0 }` if there's nothing to ask, or nothing has
 * been answered yet.
 */
export function buildCalculationInput(
  data: PortalSyncResult,
  targetPercentage: number,
  pastOverrides: PastOverrides,
  now: Date,
): CalculationRequest {
  const today = currentIstDate(now);

  const futurePeriods: DatedPeriod[] = [];
  for (const session of data.timetable) {
    if (session.date <= today || session.isSuspended) continue;
    const weekday = new Date(`${session.date}T00:00:00Z`).getUTCDay() as Weekday;
    for (const sequence of session.periods) {
      // Per-period start/end aren't used anywhere in the engine's budget
      // arithmetic (only `date` is) — the row's own fromTime/toTime is a
      // fine stand-in even for a multi-period block.
      futurePeriods.push({ date: session.date, weekday, sequence, start: session.fromTime, end: session.toTime });
    }
  }

  const heldFromOverrides = pastOverrides.attended + pastOverrides.bunked;

  return {
    currentPercentage: data.primaryAttendance.percentage,
    targetPercentage,
    now,
    config: {
      semesterStart: '',
      semesterEnd: '',
      timetable: [],
      holidays: [],
      specialSaturdays: [],
      exams: KNOWN_EXAM_PERIODS,
    },
    exactCounts: {
      held: data.primaryAttendance.numberOfClasses + heldFromOverrides,
      attended: data.primaryAttendance.present + pastOverrides.attended,
    },
    futurePeriods,
  };
}

/** True once today is past every exam range we actually know about — the result should say Mid 2 (or later) isn't accounted for yet. */
export function hasUnscheduledExamGap(now: Date): boolean {
  const today = currentIstDate(now);
  if (KNOWN_EXAM_PERIODS.length === 0) return true;
  const lastKnownExamEnd = KNOWN_EXAM_PERIODS.reduce((max, exam) => (exam.end > max ? exam.end : max), KNOWN_EXAM_PERIODS[0].end);
  return today > lastKnownExamEnd;
}
