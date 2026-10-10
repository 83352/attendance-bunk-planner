import { describe, expect, it } from 'vitest';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { PortalSyncResult, PortalTimetableSession } from './campx-client';
import { buildCalculationInput, findUngradedPastSessions, hasUnscheduledExamGap } from './to-calculation-input';

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
