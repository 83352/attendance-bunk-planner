import { describe, expect, it } from 'vitest';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { DatedPeriod } from '@/domain/schedule/types';
import { resultTier, tierFor } from './result-tier';

const future: DatedPeriod[] = Array.from({ length: 20 }, (_, index) => ({
  date: `2026-02-${String(2 + Math.floor(index / 2)).padStart(2, '0')}`,
  weekday: 1,
  sequence: (index % 2) + 1,
  start: '09:00',
  end: '10:00',
}));

const at = (held: number, attended: number, target: number, futurePeriods: DatedPeriod[] = future) =>
  calculateAttendance({
    config: { semesterStart: '', semesterEnd: '', timetable: [], holidays: [], specialSaturdays: [], exams: [] },
    now: new Date('2026-02-01T03:30:00.000Z'),
    currentPercentage: (attended / held) * 100,
    targetPercentage: target,
    exactCounts: { held, attended },
    futurePeriods,
  });

describe('resultTier', () => {
  it('is lime when at or above 75% with room to bunk, and yellow when there is none left', () => {
    expect(resultTier(at(100, 90, 75))).toBe('lime');
    expect(resultTier(at(100, 80, 75, []))).toBe('yellow'); // nothing left to bunk from
  });
  it('escalates by how much of the remaining term recovery to 75% would take', () => {
    expect(resultTier(at(100, 73, 75))).toBe('yellow'); // 8 of 20
    expect(resultTier(at(100, 72, 75))).toBe('orange'); // 12 of 20
    expect(resultTier(at(100, 70, 75))).toBe('red'); // 20 of 20
    expect(resultTier(at(100, 40, 75))).toBe('red'); // unreachable
  });
  it('tierFor always runs the maths at 75%, whatever target the student typed', () => {
    const asked: number[] = [];
    const tier = tierFor((target) => {
      asked.push(target);
      return at(100, 90, target);
    });
    expect(asked).toEqual([75]);
    expect(tier).toBe('lime');
  });
});
