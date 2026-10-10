import type { ExamPeriod, Holiday, SpecialSaturday } from '@/domain/schedule/types';
import calendar from './calendar-overrides.json';

/**
 * Calendar facts the portal is slow to publish (a holiday called the night
 * before, a special Saturday, the next mid's dates), kept in
 * `calendar-overrides.json` and edited by hand. They're patches: the portal
 * always wins once it has caught up (see `patchedTimetable`).
 */
export type CalendarOverrides = {
  holidays: Holiday[];
  specialSaturdays: SpecialSaturday[];
  exams: ExamPeriod[];
};

/** CampX semesters 1-2 are year 1, 3-4 year 2, and so on — the key the JSON file is organised by. */
export function yearOfSemester(semNo: number): number {
  return Math.ceil(semNo / 2);
}

/** `null` when the file has no entry for this year, so the result can say so instead of silently skipping patches. */
export function loadCalendarOverrides(year: number): CalendarOverrides | null {
  const entry = (calendar as Record<string, unknown>)[String(year)];
  return entry ? (entry as CalendarOverrides) : null;
}
