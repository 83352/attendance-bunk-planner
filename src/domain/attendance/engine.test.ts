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

  it('does not count an exam week as a week when averaging bunks per week', () => {
    const longer = { ...config, semesterEnd: '2026-09-13' };
    const withExam = { ...longer, exams: [{ name: 'Mid sem', start: '2026-09-07', end: '2026-09-11', periodsPerDay: 2 as const }] };
    const plain = calculateAttendance({ config: longer, now, currentPercentage: 90, targetPercentage: 75 });
    const exam = calculateAttendance({ config: withExam, now, currentPercentage: 90, targetPercentage: 75 });
    // Three teaching weeks without the exam, two with it.
    expect(plain.periodsPerWeek).toBeCloseTo(plain.maximumBunks / 3);
    expect(exam.periodsPerWeek).toBeCloseTo(exam.maximumBunks / 2);
  });

  it('keeps planned future bunks out of "held so far" and reports a projection instead', () => {
    const plain = calculateAttendance({ config, now, currentPercentage: 90, targetPercentage: 75 });
    const planned = calculateAttendance({
      config,
      now,
      currentPercentage: 90,
      targetPercentage: 75,
      adjustments: { periodOverrides: [{ date: '2026-08-25', sequence: 1, status: 'bunked' }], todayPeriods: [] },
    });
    expect(planned.heldSoFar).toBe(plain.heldSoFar);
    expect(planned.updatedCurrentPercentage).toBeCloseTo(plain.updatedCurrentPercentage);
    expect(planned.plannedPeriods).toBe(1);
    expect(planned.plannedBunks).toBe(1);
    // Projection runs through Tue 25 Aug: Mon (5) and Tue (6) are attended except the one planned bunk.
    expect(planned.projectedPercentage).toBeCloseTo(((planned.attendedSoFar + 11 - 1) / (planned.heldSoFar + 11)) * 100);
    // The planned bunk is deducted from what is left to spend.
    expect(planned.maximumBunks).toBe(plain.maximumBunks - 1);
  });

  it('projects through the last planned day, counting the classes you attend before it', () => {
    // Attend everything until Wed 26 Aug, then bunk period 1 that day.
    const planned = calculateAttendance({
      config,
      now,
      currentPercentage: 90,
      targetPercentage: 75,
      adjustments: { periodOverrides: [{ date: '2026-08-26', sequence: 1, status: 'bunked' }], todayPeriods: [] },
    });
    // Mon 5 + Tue 6 + Wed 5 periods run up to and including the planned day.
    const through = 5 + 6 + 5;
    const expected = ((planned.attendedSoFar + through - 1) / (planned.heldSoFar + through)) * 100;
    expect(planned.projectedThrough).toBe('2026-08-26');
    expect(planned.projectedPercentage).toBeCloseTo(expected);
  });

  it('never counts exam days as days you can miss', () => {
    const exams = { ...config, exams: [{ name: 'Mid sem', start: '2026-08-24', end: '2026-08-28', periodsPerDay: 2 as const }] };
    const result = calculateAttendance({ config: exams, now, currentPercentage: 100, targetPercentage: 0 });
    expect(result.maximumBunks).toBeGreaterThan(0);
    expect(result.maximumFullDaysAbsent).toBe(0);
    expect(result.teachingWeeks).toBe(0);
  });

  it('distributes bunks across uneven calendar weeks without exceeding weekly periods', () => {
    const changed = { ...config, semesterEnd: '2026-09-05', holidays: [{ name: 'Holiday', start: '2026-08-25', end: '2026-08-28' }] };
    const result = calculateAttendance({ config: changed, now, currentPercentage: 90, targetPercentage: 75 });
    expect(result.practicalBunksByWeek.reduce((sum, value) => sum + value, 0)).toBe(result.maximumBunks);
    expect(result.practicalBunksByWeek.every((value) => value >= 0)).toBe(true);
  });

  it('converts the bunk budget into whole college days', () => {
    // 26 future periods across Mon-Fri; budget is 7 (see the test above).
    // The days left run 5, 6, 5, 5, 5 periods. Heaviest first takes the 6,
    // and the next day (5) would reach 11, past the budget of 7.
    const result = calculateAttendance({ config, now, currentPercentage: 80, targetPercentage: 75 });
    expect(result.maximumBunks).toBe(7);
    expect(result.maximumFullDaysAbsent).toBe(1);
  });

  it('reports zero absent days when nothing can be bunked', () => {
    // 26 held + 26 left at a 75% target needs 39 attended; an estimated 13
    // attended so far leaves exactly no slack, so the budget is 0 periods.
    const result = calculateAttendance({ config, now, currentPercentage: 50, targetPercentage: 75 });
    expect(result.maximumBunks).toBe(0);
    expect(result.maximumFullDaysAbsent).toBe(0);
  });

  // The guarantee the number carries: skipping ANY n days, in any combination,
  // stays inside the budget. That holds exactly when the n longest days fit.
  const longestDaysFit = (config: ScheduleConfig, currentPercentage: number) => {
    const result = calculateAttendance({ config, now, currentPercentage, targetPercentage: 75 });
    const periodsByDate = new Map<string, number>();
    for (const period of buildCalendar(config, now).future) periodsByDate.set(period.date, (periodsByDate.get(period.date) ?? 0) + 1);
    const longestFirst = [...periodsByDate.values()].sort((a, b) => b - a);
    const sum = (days: number[]) => days.reduce((total, value) => total + value, 0);
    return {
      worstCase: sum(longestFirst.slice(0, result.maximumFullDaysAbsent)),
      oneMore: sum(longestFirst.slice(0, result.maximumFullDaysAbsent + 1)),
      budget: result.maximumBunks,
      days: result.maximumFullDaysAbsent,
      daysAvailable: longestFirst.length,
    };
  };

  it('stays within budget even if the longest days are the ones skipped', () => {
    const { worstCase, budget } = longestDaysFit(config, 100);
    expect(worstCase).toBeLessThanOrEqual(budget);
  });

  it('counts as many days as the budget allows, not fewer', () => {
    const { oneMore, budget, days, daysAvailable } = longestDaysFit(config, 80);
    expect(days).toBeLessThan(daysAvailable);
    expect(oneMore).toBeGreaterThan(budget);
  });

  it('holds the guarantee on an uneven timetable', () => {
    // Mon 4, Tue 5, Wed 6, Thu 6, Fri 3 -- a real section's spread, and the
    // case where calendar order and heaviest-first disagree.
    const uneven: ScheduleConfig = {
      ...config,
      semesterEnd: '2026-09-30',
      timetable: Object.entries({ 1: 4, 2: 5, 3: 6, 4: 6, 5: 3 }).flatMap(([weekday, count]) =>
        Array.from({ length: count }, (_, index) => ({ weekday: Number(weekday) as 1 | 2 | 3 | 4 | 5, sequence: index + 1, start: '09:00', end: '09:50' })),
      ),
    };
    const { worstCase, oneMore, budget, days, daysAvailable } = longestDaysFit(uneven, 85);
    expect(days).toBeGreaterThan(0);
    expect(worstCase).toBeLessThanOrEqual(budget);
    if (days < daysAvailable) expect(oneMore).toBeGreaterThan(budget);
  });

  it('reports zero absent days once the semester has no periods left', () => {
    const ended = { ...config, semesterEnd: '2026-08-23' };
    const result = calculateAttendance({ config: ended, now, currentPercentage: 80, targetPercentage: 75 });
    expect(result.remainingPeriods).toBe(0);
    expect(result.maximumFullDaysAbsent).toBe(0);
  });

  it('reports heldPeriods matching the calendar builder (excludes today)', () => {
    const result = calculateAttendance({ config, now, currentPercentage: 80, targetPercentage: 75 });
    const calendar = buildCalendar(config, now);
    expect(result.heldPeriods).toBe(calendar.heldThroughYesterday.length);
  });

  it('reports zero heldPeriods before the semester starts', () => {
    const future = { ...config, semesterStart: '2026-12-01', semesterEnd: '2026-12-15' };
    const result = calculateAttendance({ config: future, now, currentPercentage: 80, targetPercentage: 75 });
    expect(result.heldPeriods).toBe(0);
  });
});

describe('exact counts from the portal', () => {
  it('overrides the calendar-estimated held/attended counts when provided', () => {
    const estimated = calculateAttendance({ config, now, currentPercentage: 90, targetPercentage: 75 });
    const exact = calculateAttendance({
      config,
      now,
      currentPercentage: 90, // ignored when exactCounts is present
      targetPercentage: 75,
      exactCounts: { held: 340, attended: 271 },
    });
    expect(exact.heldPeriods).toBe(340);
    expect(exact.attendedPeriods).toBe(271);
    expect(exact.updatedCurrentPercentage).toBeCloseTo((271 / 340) * 100);
    expect(exact.heldPeriods).not.toBe(estimated.heldPeriods);
  });

  it('uses an exact future-period list instead of the calendar, still excluding exam days from the day/week stats', () => {
    // Four regular dates (2 periods each, 8 total) plus one 4-period exam day,
    // all in one supplied list — no admin timetable involved.
    const futurePeriods = [
      { date: '2026-01-05', weekday: 1 as const, sequence: 1, start: '09:00', end: '09:50' },
      { date: '2026-01-05', weekday: 1 as const, sequence: 2, start: '10:00', end: '10:50' },
      { date: '2026-01-06', weekday: 2 as const, sequence: 1, start: '09:00', end: '09:50' },
      { date: '2026-01-06', weekday: 2 as const, sequence: 2, start: '10:00', end: '10:50' },
      { date: '2026-01-12', weekday: 1 as const, sequence: 1, start: '00:00', end: '23:59' },
      { date: '2026-01-12', weekday: 1 as const, sequence: 2, start: '00:00', end: '23:59' },
      { date: '2026-01-12', weekday: 1 as const, sequence: 3, start: '00:00', end: '23:59' },
      { date: '2026-01-12', weekday: 1 as const, sequence: 4, start: '00:00', end: '23:59' },
      { date: '2026-01-13', weekday: 2 as const, sequence: 1, start: '09:00', end: '09:50' },
      { date: '2026-01-13', weekday: 2 as const, sequence: 2, start: '10:00', end: '10:50' },
      { date: '2026-01-14', weekday: 3 as const, sequence: 1, start: '09:00', end: '09:50' },
      { date: '2026-01-14', weekday: 3 as const, sequence: 2, start: '10:00', end: '10:50' },
    ];
    const examConfig = { ...config, exams: [{ name: 'Mid', start: '2026-01-12', end: '2026-01-12', periodsPerDay: 4 as const }] };
    const result = calculateAttendance({
      config: examConfig,
      now: new Date('2026-01-01T03:30:00.000Z'),
      currentPercentage: 100,
      targetPercentage: 75,
      exactCounts: { held: 10, attended: 10 },
      futurePeriods,
    });
    expect(result.remainingPeriods).toBe(12); // exam periods still count toward the budget
    expect(result.maximumBunks).toBe(5);
    // Heaviest-first would pick the 4-period exam day first if it weren't
    // excluded, giving 1 day instead of 2 within a budget of 5.
    expect(result.maximumFullDaysAbsent).toBe(2);
  });
});
