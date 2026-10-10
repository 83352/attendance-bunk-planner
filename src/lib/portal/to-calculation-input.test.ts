import { describe, expect, it } from 'vitest';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { PortalSyncResult, PortalTimetableSession } from './campx-client';
import type { CalendarOverrides } from './calendar-overrides';
import { buildCalculationInput, findUngradedPastSessions, hasUnscheduledExamGap, patchedTimetable } from './to-calculation-input';

const now = new Date('2026-09-10T05:00:00.000Z'); // 2026-09-10 in IST

function session(partial: Partial<PortalTimetableSession> & Pick<PortalTimetableSession, 'date' | 'periods'>): PortalTimetableSession {
  return {
    day: 'MONDAY',
    fromTime: '09:10:00',
    toTime: '10:10:00',
    subjectName: 'Test Subject',
    subjectCode: 'TS101',
    facultyNames: [],
    groupName: null,
    isSuspended: false,
    completed: true,
    attended: null,
    ...partial,
  };
}

const data: PortalSyncResult = {
  currentSemNo: 3,
  semesterSummary: { currentSemNo: 3, classAverage: 80, overallAttendance: '80', subjects: [] },
  primaryAttendance: { numberOfClasses: 100, present: 80, absent: 20, totalSessionsIncludingActivity: 100, percentage: 80 },
  dateWiseAttendance: {},
  timetable: [
    // A past session the portal already graded — not ungraded.
    session({ date: '2026-09-01', periods: [1], attended: true }),
    // A past session the portal hasn't graded yet.
    session({ date: '2026-09-05', periods: [1], attended: null }),
    // A suspended past session — not "ungraded", it never happened.
    session({ date: '2026-09-06', periods: [1], attended: null, isSuspended: true }),
    // A future 2-period lab.
    session({ date: '2026-09-15', periods: [4, 5], attended: null }),
    // A suspended future session — excluded from the budget entirely.
    session({ date: '2026-09-16', periods: [1], attended: null, isSuspended: true }),
  ],
};

describe('findUngradedPastSessions', () => {
  it('finds only non-suspended past/today sessions with no recorded attendance', () => {
    const found = findUngradedPastSessions(data, now);
    expect(found).toHaveLength(1);
    expect(found[0].date).toBe('2026-09-05');
  });
});

describe('findUngradedPastSessions — today', () => {
  const todayData: PortalSyncResult = {
    ...data,
    timetable: [
      session({ date: '2026-09-10', periods: [1], fromTime: '09:10:00', toTime: '10:10:00' }),
      session({ date: '2026-09-10', periods: [2], fromTime: '14:00:00', toTime: '15:00:00' }),
    ],
  };
  it('asks only about today periods whose end time has passed (10:30 IST here)', () => {
    const found = findUngradedPastSessions(todayData, now);
    expect(found.map((s) => s.fromTime)).toEqual(['09:10:00']);
  });
});

describe('buildCalculationInput', () => {
  it('builds exactCounts from primaryAttendance plus the answered past overrides', () => {
    const input = buildCalculationInput(data, 75, { attended: 1, bunked: 0 }, now);
    expect(input.exactCounts).toEqual({ held: 101, attended: 81 });
  });

  it('expands future sessions into one DatedPeriod per period, excluding suspended and past/today ones', () => {
    const input = buildCalculationInput(data, 75, { attended: 0, bunked: 0 }, now);
    expect(input.futurePeriods).toHaveLength(2); // the 2-period lab on 09-15 only
    expect(input.futurePeriods?.every((p) => p.date === '2026-09-15')).toBe(true);
    expect(input.futurePeriods?.map((p) => p.sequence)).toEqual([4, 5]);
  });

  it('produces a request the engine accepts end to end', () => {
    const input = buildCalculationInput(data, 75, { attended: 0, bunked: 1 }, now);
    const result = calculateAttendance(input);
    expect(result.heldPeriods).toBe(101);
    expect(result.remainingPeriods).toBe(2);
  });
});

describe('hasUnscheduledExamGap', () => {
  it('is true once today is past the last known exam range', () => {
    // KNOWN_EXAM_PERIODS' only entry (Mid 1) ends 2026-09-05; "now" here is 09-10.
    expect(hasUnscheduledExamGap(now)).toBe(true);
  });

  it('is false while still within or before the last known exam range', () => {
    expect(hasUnscheduledExamGap(new Date('2026-09-02T05:00:00.000Z'))).toBe(false);
  });
});

describe('patchedTimetable', () => {
  const none: CalendarOverrides = { holidays: [], specialSaturdays: [], exams: [] };
  // 2026-09-15 is a Tuesday; 2026-09-19 is the Saturday that follows it.

  it('drops ungraded sessions on a holiday the portal has not caught up with, but keeps graded ones', () => {
    const overrides = { ...none, holidays: [{ name: 'Test day', start: '2026-09-15', end: '2026-09-15' }] };
    const patched = patchedTimetable(data, overrides, now);
    expect(patched.some((s) => s.date === '2026-09-15')).toBe(false);
    const graded = patchedTimetable(data, { ...none, holidays: [{ name: 'x', start: '2026-09-01', end: '2026-09-01' }] }, now);
    expect(graded.some((s) => s.date === '2026-09-01')).toBe(true);
  });

  it('drops an ungraded session listed as a portal bug, but not a graded one or a different time', () => {
    const buggy = session({ date: '2026-09-05', periods: [1], subjectName: 'Test Subject', fromTime: '09:10:00', attended: null });
    const overrides = { ...none, ignoredSessions: [{ date: '2026-09-05', subjectName: 'Test Subject', fromTime: '09:10' }] };
    expect(patchedTimetable(data, overrides, now).some((s) => s.date === '2026-09-05')).toBe(false);
    const graded = { ...data, timetable: [{ ...buggy, attended: true }] };
    expect(patchedTimetable(graded, overrides, now)).toHaveLength(1);
    const otherTime = { ...overrides, ignoredSessions: [{ date: '2026-09-05', subjectName: 'Test Subject', fromTime: '14:00' }] };
    expect(patchedTimetable(data, otherTime, now).some((s) => s.date === '2026-09-05')).toBe(true);
  });

  it('synthesizes a special Saturday from the copied weekday when the portal has no rows for it', () => {
    const overrides = { ...none, specialSaturdays: [{ date: '2026-09-19', copiedWeekday: 2 as const }] };
    const patched = patchedTimetable(data, overrides, now);
    const added = patched.filter((s) => s.date === '2026-09-19');
    expect(added).toHaveLength(1);
    expect(added[0].periods).toEqual([4, 5]);
    expect(added[0].synthetic).toBe(true);
  });

  it('leaves a special Saturday alone once the portal has its own rows for that date', () => {
    const withRows = { ...data, timetable: [...data.timetable, session({ date: '2026-09-19', periods: [1] })] };
    const overrides = { ...none, specialSaturdays: [{ date: '2026-09-19', copiedWeekday: 2 as const }] };
    expect(patchedTimetable(withRows, overrides, now).filter((s) => s.date === '2026-09-19')).toHaveLength(1);
  });

  it('adds exam periods for future exam days the portal has not published, skipping Sundays', () => {
    const overrides = { ...none, exams: [{ name: 'Mid 2', start: '2026-11-02', end: '2026-11-08', periodsPerDay: 2 as const }] };
    const added = patchedTimetable(data, overrides, now).filter((s) => s.synthetic);
    expect(added.map((s) => s.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
    expect(added.every((s) => s.periods.length === 2)).toBe(true);
  });
});
