import { dateInRange, type MonthCalendarData } from '@/domain/schedule/calendar';
import type { CalendarOverrides } from './calendar-overrides';
import type { PortalTimetableSession } from './campx-client';

/** First and last day anything is scheduled (portal rows plus the manual calendar's exams) — the range the month calendar can page through. */
export function semesterBounds(timetable: PortalTimetableSession[], overrides: CalendarOverrides | null): { start: string; end: string } | null {
  const dates = [...timetable.map((s) => s.date), ...(overrides?.exams.flatMap((e) => [e.start, e.end]) ?? [])].sort();
  return dates.length === 0 ? null : { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * One month's day cells for the calendar, built from the (already patched)
 * portal timetable instead of an admin-entered timetable. Same output shape
 * as the domain's `monthCalendarData`, so the grid renders identically.
 */
export function portalMonthData(
  timetable: PortalTimetableSession[],
  overrides: CalendarOverrides | null,
  bounds: { start: string; end: string },
  year: number,
  month: number,
  todayIso: string,
): MonthCalendarData {
  const blanks = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let totalPeriods = 0;

  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const inSemester = dateInRange(iso, bounds.start, bounds.end);
    const sessions = timetable.filter((s) => s.date === iso);
    const count = inSemester ? sessions.filter((s) => !s.isSuspended).reduce((sum, s) => sum + s.periods.length, 0) : 0;
    totalPeriods += count;

    const holiday = inSemester ? overrides?.holidays.find((h) => dateInRange(iso, h.start, h.end)) : undefined;
    // A day the portal itself has suspended entirely reads the same as a holiday.
    const suspended = inSemester && sessions.length > 0 && sessions.every((s) => s.isSuspended);
    const exam = inSemester ? overrides?.exams.find((e) => dateInRange(iso, e.start, e.end)) : undefined;
    const isSpecialSaturday = inSemester && (overrides?.specialSaturdays.some((s) => s.date === iso) ?? false);

    return {
      day,
      iso,
      count,
      inSemester,
      isHoliday: holiday !== undefined || suspended,
      isExam: exam !== undefined,
      isSpecialSaturday,
      isToday: iso === todayIso,
      holidayName: holiday?.name ?? (suspended ? 'Classes suspended' : undefined),
      examName: exam?.name,
    };
  });

  return { year, month, blanks, dayCells, totalPeriods };
}
