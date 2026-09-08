import { describe, expect, it } from 'vitest';
import { buildCalendar, periodsForDate } from './calendar';
import type { ScheduleConfig } from './types';

// 3rd year has college every Saturday except the 2nd Saturday of the month.
// Nothing in the domain ever said weekends are empty -- periodsForDate simply
// looks up timetableFor(weekday), and Saturdays came back blank only because
// no weekday-6 rows existed. These pin that down, because "Saturday is a real
// teaching day" is a new assumption for this codebase and an easy one to
// break while tidying up the weekday handling.

// September 2026: Saturdays fall on the 5th, 12th, 19th and 26th, so the 12th
// is the 2nd Saturday and the one that should be off.
const config: ScheduleConfig = {
  semesterStart: '2026-09-01',
  semesterEnd: '2026-09-30',
  timetable: [
    ...Array.from({ length: 6 }, (_, index) => ({ weekday: 1 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
    ...Array.from({ length: 4 }, (_, index) => ({ weekday: 6 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
  ],
  holidays: [{ name: '2nd Saturday', start: '2026-09-12', end: '2026-09-12' }],
  specialSaturdays: [],
  exams: [],
};

describe('a year with its own Saturday timetable', () => {
  it('gives every Saturday its weekday-6 periods without any per-date entry', () => {
    for (const saturday of ['2026-09-05', '2026-09-19', '2026-09-26']) {
      expect(periodsForDate(config, saturday)).toHaveLength(4);
    }
  });

  it('leaves the 2nd Saturday empty, because a holiday outranks the timetable', () => {
    expect(periodsForDate(config, '2026-09-12')).toHaveLength(0);
  });

  it('still leaves Sunday empty', () => {
    expect(periodsForDate(config, '2026-09-06')).toHaveLength(0);
  });

  it('counts Saturday periods toward the semester total', () => {
    // Four Saturdays in range, one of them a holiday, four periods each.
    const calendar = buildCalendar(config, new Date('2026-10-01T03:30:00.000Z'));
    const saturdayPeriods = calendar.heldThroughYesterday.filter((period) => period.weekday === 6);
    expect(saturdayPeriods).toHaveLength(12);
  });

  it('does not give Saturday periods to a year that has none', () => {
    const weekdaysOnly: ScheduleConfig = { ...config, timetable: config.timetable.filter((period) => period.weekday !== 6), holidays: [] };
    expect(periodsForDate(weekdaysOnly, '2026-09-05')).toHaveLength(0);
  });
});
