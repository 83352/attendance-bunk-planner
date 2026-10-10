import type { CalculationRequest } from '@/domain/attendance/types';
import { currentIstDate, datesBetween, dateInRange } from '@/domain/schedule/calendar';
import type { DatedPeriod, ExamPeriod, Weekday } from '@/domain/schedule/types';
import type { CalendarOverrides } from './calendar-overrides';
import { KNOWN_EXAM_PERIODS } from './exam-schedule';
import type { PortalSyncResult, PortalTimetableSession } from './campx-client';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday;

/** The admin-entered exams if they loaded, else the hardcoded fallback. */
function examsFor(overrides: CalendarOverrides | null): ExamPeriod[] {
  return overrides ? overrides.exams : KNOWN_EXAM_PERIODS;
}

/**
 * The portal's timetable with the admin's not-yet-published calendar facts
 * layered on. Every patch only fills a gap the portal has left, so once the
 * portal catches up its own rows simply win and the patch stops doing anything:
 *  - holiday / known portal bug: ungraded sessions on that date (or the listed
 *    session) are dropped (graded ones were counted by the portal, so they stay);
 *  - special Saturday / exam day with no portal rows at all: synthesized (a
 *    copy of the student's own sessions from the copied weekday / the exam's
 *    periods per day), flagged `synthetic`.
 */
export function patchedTimetable(data: PortalSyncResult, overrides: CalendarOverrides | null, now: Date): PortalTimetableSession[] {
  if (!overrides) return data.timetable;
  const today = currentIstDate(now);
  const isHoliday = (date: string) => overrides.holidays.some((holiday) => dateInRange(date, holiday.start, holiday.end));
  const isExamDay = (date: string) => overrides.exams.some((exam) => dateInRange(date, exam.start, exam.end));

  const isIgnored = (session: PortalTimetableSession) =>
    (overrides.ignoredSessions ?? []).some(
      (ignored) => ignored.date === session.date && ignored.subjectName === session.subjectName && session.fromTime.startsWith(ignored.fromTime),
    );
  const timetable = data.timetable.filter(
    (session) => session.attended !== null || !(isHoliday(session.date) || isIgnored(session)),
  );
  const datesWithSessions = new Set(data.timetable.map((session) => session.date));
  const synthesized: PortalTimetableSession[] = [];

  for (const special of overrides.specialSaturdays) {
    if (datesWithSessions.has(special.date) || isHoliday(special.date)) continue;
    // Closest ordinary day of the copied weekday that actually had classes.
    const distance = (date: string) => Math.abs(Date.parse(date) - Date.parse(special.date));
    const templateDate = [...new Set(data.timetable.map((session) => session.date))]
      .filter((date) => weekdayOf(date) === special.copiedWeekday && !isHoliday(date) && !isExamDay(date))
      .sort((a, b) => distance(a) - distance(b))[0];
    if (!templateDate) continue;
    for (const session of data.timetable.filter((s) => s.date === templateDate && !s.isSuspended)) {
      synthesized.push({ ...session, date: special.date, day: 'SATURDAY', completed: false, attended: null, synthetic: true });
    }
  }

  for (const exam of overrides.exams) {
    for (const date of datesBetween(exam.start, exam.end)) {
      // Past exam days are the portal's job (and a Sunday is never an exam day).
      if (date <= today || weekdayOf(date) === 0 || isHoliday(date) || datesWithSessions.has(date)) continue;
      synthesized.push({
        date,
        day: 'EXAM',
        fromTime: '00:00:00',
        toTime: '23:59:00',
        periods: Array.from({ length: exam.periodsPerDay }, (_, index) => index + 1),
        subjectName: exam.name,
        subjectCode: '',
        facultyNames: [],
        groupName: null,
        isSuspended: false,
        completed: false,
        attended: null,
        synthetic: true,
      });
    }
  }

  return [...timetable, ...synthesized].sort((a, b) => (a.date + a.fromTime).localeCompare(b.date + b.fromTime));
}

/** Past/today sessions the portal hasn't graded yet — the student needs to answer these before a number can be computed. */
export function findUngradedPastSessions(data: PortalSyncResult, now: Date, overrides: CalendarOverrides | null = null): PortalTimetableSession[] {
  const today = currentIstDate(now);
  return patchedTimetable(data, overrides, now).filter((session) => session.date <= today && !session.isSuspended && session.attended === null);
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
  overrides: CalendarOverrides | null = null,
): CalculationRequest {
  const today = currentIstDate(now);

  const futurePeriods: DatedPeriod[] = [];
  for (const session of patchedTimetable(data, overrides, now)) {
    if (session.date <= today || session.isSuspended) continue;
    const weekday = weekdayOf(session.date);
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
      exams: examsFor(overrides),
    },
    exactCounts: {
      held: data.primaryAttendance.numberOfClasses + heldFromOverrides,
      attended: data.primaryAttendance.present + pastOverrides.attended,
    },
    futurePeriods,
  };
}

/** True once today is past every exam range we actually know about — the result should say the next exam isn't accounted for yet. */
export function hasUnscheduledExamGap(now: Date, overrides: CalendarOverrides | null = null): boolean {
  const today = currentIstDate(now);
  const exams = examsFor(overrides);
  if (exams.length === 0) return true;
  const lastKnownExamEnd = exams.reduce((max, exam) => (exam.end > max ? exam.end : max), exams[0].end);
  return today > lastKnownExamEnd;
}

/** What manual patches are actually in play right now, for the "why is this number different" note. */
export function describeActivePatches(data: PortalSyncResult, overrides: CalendarOverrides | null, now: Date): string[] {
  if (!overrides) return [];
  const today = currentIstDate(now);
  const lines: string[] = [];

  const droppedHolidays = data.timetable.filter(
    (s) => s.date > today && s.attended === null && overrides.holidays.some((h) => dateInRange(s.date, h.start, h.end)),
  );
  const holidayNames = [...new Set(droppedHolidays.map((s) => overrides.holidays.find((h) => dateInRange(s.date, h.start, h.end))?.name ?? 'holiday'))];
  if (holidayNames.length > 0) lines.push(`Holidays not on the portal yet: ${holidayNames.join(', ')}`);

  const synthetic = patchedTimetable(data, overrides, now).filter((s) => s.synthetic && s.date > today);
  const satDates = [...new Set(synthetic.filter((s) => s.day === 'SATURDAY').map((s) => s.date))];
  if (satDates.length > 0) lines.push(`Special Saturdays not on the portal yet: ${satDates.join(', ')}`);
  const examNames = [...new Set(synthetic.filter((s) => s.day === 'EXAM').map((s) => s.subjectName))];
  if (examNames.length > 0) lines.push(`Exam days not on the portal yet: ${examNames.join(', ')}`);
  return lines;
}
