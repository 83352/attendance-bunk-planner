import { describe, expect, it } from 'vitest';
import type { PortalTimetableSession } from './campx-client';
import type { CalendarOverrides } from './calendar-overrides';
import { portalMonthData, semesterBounds } from './month-data';

const s = (date: string, periods: number[], isSuspended = false): PortalTimetableSession => ({
  date, day: 'X', fromTime: '09:00:00', toTime: '10:00:00', periods, subjectName: 'S', subjectCode: 'S1',
  facultyNames: [], groupName: null, isSuspended, completed: false, attended: null,
});

const overrides: CalendarOverrides = {
  holidays: [{ name: 'Test holiday', start: '2026-09-03', end: '2026-09-03' }],
  specialSaturdays: [{ date: '2026-09-05', copiedWeekday: 1 }],
  exams: [{ name: 'Mid', start: '2026-09-07', end: '2026-09-08', periodsPerDay: 2 }],
};
const timetable = [s('2026-09-01', [1, 2]), s('2026-09-02', [1], true), s('2026-09-02', [2], true), s('2026-09-30', [1])];

describe('portalMonthData', () => {
  const bounds = semesterBounds(timetable, overrides)!;
  const cells = portalMonthData(timetable, overrides, bounds, 2026, 8, '2026-09-01').dayCells;
  const cell = (day: number) => cells[day - 1];

  it('spans the portal rows and the exams', () => {
    expect(bounds).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
  it('counts periods, and marks today', () => {
    expect(cell(1)).toMatchObject({ count: 2, isToday: true });
  });
  it('treats a fully suspended day as a holiday with no periods', () => {
    expect(cell(2)).toMatchObject({ count: 0, isHoliday: true, holidayName: 'Classes suspended' });
  });
  it('marks manual holidays, special Saturdays and exams', () => {
    expect(cell(3)).toMatchObject({ isHoliday: true, holidayName: 'Test holiday' });
    expect(cell(5).isSpecialSaturday).toBe(true);
    expect(cell(7)).toMatchObject({ isExam: true, examName: 'Mid' });
  });
});

describe('day attendance colour', () => {
  const marked = (date: string, attended: boolean | null, suspended = false): PortalTimetableSession => ({ ...s2(date), attended, isSuspended: suspended });
  const s2 = (date: string) => ({
    date, day: 'X', fromTime: '09:00:00', toTime: '10:00:00', periods: [1], subjectName: 'S', subjectCode: 'S1',
    facultyNames: [], groupName: null, isSuspended: false, completed: true, attended: null as boolean | null,
  });
  const cellFor = (sessions: PortalTimetableSession[]) =>
    portalMonthData(sessions, null, { start: '2026-09-01', end: '2026-09-30' }, 2026, 8, '2026-09-30').dayCells[0];

  it('is attended only when every period is attended', () => {
    expect(cellFor([marked('2026-09-01', true), marked('2026-09-01', true)]).attendance).toBe('attended');
  });
  it('is bunked when some periods were bunked and absent when all were', () => {
    expect(cellFor([marked('2026-09-01', true), marked('2026-09-01', false)]).attendance).toBe('bunked');
    expect(cellFor([marked('2026-09-01', false), marked('2026-09-01', false)]).attendance).toBe('absent');
  });
  it('shows nothing while any period is unmarked, and ignores suspended periods', () => {
    expect(cellFor([marked('2026-09-01', true), marked('2026-09-01', null)]).attendance).toBeUndefined();
    expect(cellFor([marked('2026-09-01', true), marked('2026-09-01', null, true)]).attendance).toBe('attended');
  });
});
