import { describe, expect, it } from 'vitest';
import { semesterConfigSchema } from './config';

const baseConfig = {
  semesterStart: '2026-07-06',
  semesterEnd: '2026-11-07',
  timetable: [],
  holidays: [],
  specialSaturdays: [] as { date: string; copiedWeekday: number }[],
  exams: [] as { name: 'Mid 1' | 'Mid 2'; start: string; end: string; periodsPerDay: 2 | 4 }[],
};

describe('semesterConfigSchema', () => {
  it('accepts a valid empty configuration', () => {
    expect(semesterConfigSchema.safeParse(baseConfig).success).toBe(true);
  });

  it('rejects exams outside the semester', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      exams: [{ name: 'Mid 1', start: '2026-11-01', end: '2026-11-30', periodsPerDay: 2 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Exam dates must be inside the semester.');
  });

  it('rejects holidays outside the semester', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      holidays: [{ name: 'Break', start: '2026-06-30', end: '2026-07-10' }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Holiday dates must be inside the semester.');
  });

  it('rejects duplicate special Saturday dates', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      specialSaturdays: [
        { date: '2026-07-25', copiedWeekday: 1 },
        { date: '2026-07-25', copiedWeekday: 2 },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Each special Saturday can only be listed once.');
  });

  it('rejects special Saturdays outside the semester', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      specialSaturdays: [{ date: '2026-12-25', copiedWeekday: 1 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Special Saturday dates must be inside the semester.');
  });

  it('accepts exceptions exactly on the semester boundaries', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      holidays: [{ name: 'Term edges', start: '2026-07-06', end: '2026-11-07' }],
      specialSaturdays: [{ date: '2026-07-11', copiedWeekday: 2 }],
      exams: [{ name: 'Mid 2', start: '2026-11-02', end: '2026-11-07', periodsPerDay: 4 }],
    });
    expect(parsed.success).toBe(true);
  });
});
