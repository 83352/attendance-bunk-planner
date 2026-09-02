import { describe, expect, it } from 'vitest';
import { buildCalendar, periodsForDate } from '../schedule/calendar';
import type { ScheduleConfig } from '../schedule/types';
import { calculateAttendance } from './engine';

const config: ScheduleConfig = {
  semesterStart: '2026-08-17',
  semesterEnd: '2026-08-30',
  timetable: [
    ...Array.from({ length: 5 }, (_, index) => ({ weekday: 1 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
    ...Array.from({ length: 6 }, (_, index) => ({ weekday: 2 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
    ...Array.from({ length: 5 }, (_, index) => ({ weekday: 3 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
    ...Array.from({ length: 5 }, (_, index) => ({ weekday: 4 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
    ...Array.from({ length: 5 }, (_, index) => ({ weekday: 5 as const, sequence: index + 1, start: '09:00', end: '09:50' })),
  ],
  holidays: [],
  specialSaturdays: [],
  exams: [],
};

const now = new Date('2026-08-23T03:30:00.000Z');

describe('calendar engine', () => {
  it('excludes today and applies weekday timetable counts', () => {
    const calendar = buildCalendar(config, now);
    expect(calendar.today).toHaveLength(0);
    expect(calendar.futureByWeek.get('2026-08-24')).toHaveLength(26);
  });

  it('uses holiday precedence and copied Saturday schedules', () => {
    const changed = {
      ...config,
      holidays: [{ name: 'Holiday', start: '2026-08-25', end: '2026-08-26' }],
      specialSaturdays: [{ date: '2026-08-29', copiedWeekday: 2 as const }],
    };
    expect(periodsForDate(changed, '2026-08-25')).toHaveLength(0);
    expect(periodsForDate(changed, '2026-08-29')).toHaveLength(6);
  });

  it('lets an exam replace the timetable while a holiday still wins', () => {
    const changed = {
      ...config,
      holidays: [{ name: 'Holiday', start: '2026-08-26', end: '2026-08-26' }],
      exams: [{ name: 'Mid 1' as const, start: '2026-08-25', end: '2026-08-27', periodsPerDay: 4 as const }],
    };
    expect(periodsForDate(changed, '2026-08-25')).toHaveLength(4);
    expect(periodsForDate(changed, '2026-08-26')).toHaveLength(0);
  });

  it('supports a different period count on one exam day', () => {
    const changed = {
      ...config,
      exams: [{ name: 'Mid 1' as const, start: '2026-08-24', end: '2026-08-27', periodsPerDay: 4 as const, dailyPeriods: [{ date: '2026-08-27', periodsPerDay: 2 as const }] }],
    };
    expect(periodsForDate(changed, '2026-08-24')).toHaveLength(4);
    expect(periodsForDate(changed, '2026-08-27')).toHaveLength(2);
  });

  it('treats a custom-named exam like a mid exam', () => {
    const changed = {
      ...config,
      exams: [{ name: 'Saturday test', start: '2026-08-29', end: '2026-08-29', periodsPerDay: 2 as const }],
    };
    expect(periodsForDate(changed, '2026-08-29')).toHaveLength(2);
  });
});

describe('attendance engine', () => {
  it('rejects non-finite and out-of-range percentages', () => {
    expect(() => calculateAttendance({ config, now, currentPercentage: Number.NaN, targetPercentage: 75 })).toThrow('Current attendance must be between 0 and 100.');
    expect(() => calculateAttendance({ config, now, currentPercentage: 80, targetPercentage: 101 })).toThrow('Target attendance must be between 0 and 100.');
  });

  it('calculates conservative maximum bunks and recovery periods', () => {
    const result = calculateAttendance({ config, now, currentPercentage: 80, targetPercentage: 75 });
    expect(result.heldPeriods).toBe(26);
    expect(result.remainingPeriods).toBe(26);
    expect(result.maximumBunks).toBe(7);
    expect(result.finalPercentageAtMaximumBunks).toBeGreaterThanOrEqual(75);
    expect(result.finalPercentageAtMaximumBunks).toBeLessThan(77);
  });

  it('returns zero bunks and reachable recovery for below-target attendance', () => {
    const result = calculateAttendance({ config, now, currentPercentage: 60, targetPercentage: 75 });
    expect(result.maximumBunks).toBe(2);
    expect(result.recoveryTo75.periodsRequired).toBe(16);
    expect(result.recoveryTo75.minimumCollegeDays).toBe(3);
    expect(result.recoveryToTarget.reachable).toBe(true);
  });

  it('handles no remaining periods without division errors', () => {
    const ended = { ...config, semesterEnd: '2026-08-23' };
    const result = calculateAttendance({ config: ended, now, currentPercentage: 80, targetPercentage: 75 });
    expect(result.remainingPeriods).toBe(0);
    expect(result.maximumBunks).toBe(0);
    expect(result.periodsPerWeek).toBe(0);
  });

  it('supports decimal attendance and target percentages', () => {
    const result = calculateAttendance({ config, now, currentPercentage: 78.25, targetPercentage: 81.5 });
    expect(result.currentPercentage).toBe(78.25);
    expect(result.targetPercentage).toBe(81.5);
    expect(Number.isInteger(result.maximumBunks)).toBe(true);
  });

  it('allows a lower final target to produce additional bunks', () => {
    const result = calculateAttendance({ config, now, currentPercentage: 80, targetPercentage: 70 });
    const stricter = calculateAttendance({ config, now, currentPercentage: 80, targetPercentage: 75 });
    expect(result.maximumBunks).toBeGreaterThan(stricter.maximumBunks);
  });

  it('reports an unreachable recovery target', () => {
    const result = calculateAttendance({ config, now, currentPercentage: 0, targetPercentage: 100 });
    expect(result.recoveryToTarget.reachable).toBe(false);
    expect(result.recoveryToTarget.periodsRequired).toBeNull();
    expect(result.recoveryToTarget.minimumCollegeDays).toBeNull();
  });

  it('distributes bunks across uneven calendar weeks without exceeding weekly periods', () => {
    const changed = { ...config, semesterEnd: '2026-09-05', holidays: [{ name: 'Holiday', start: '2026-08-25', end: '2026-08-28' }] };
    const result = calculateAttendance({ config: changed, now, currentPercentage: 90, targetPercentage: 75 });
    expect(result.practicalBunksByWeek.reduce((sum, value) => sum + value, 0)).toBe(result.maximumBunks);
    expect(result.practicalBunksByWeek.every((value) => value >= 0)).toBe(true);
  });
});
