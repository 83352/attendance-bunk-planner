import { describe, expect, it } from 'vitest';
import { semesterConfigSchema } from './config';

const baseConfig = {
  semesterStart: '2026-07-06',
  semesterEnd: '2026-11-07',
  timetable: [],
  holidays: [],
  specialSaturdays: [] as { date: string; copiedWeekday: number }[],
  exams: [] as { name: string; start: string; end: string; periodsPerDay: 2 | 4 }[],
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

  it('accepts a custom-named exam inside the semester', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      exams: [{ name: 'Saturday test', start: '2026-08-29', end: '2026-08-29', periodsPerDay: 2 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an exam with a blank name', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      exams: [{ name: '   ', start: '2026-08-29', end: '2026-08-29', periodsPerDay: 2 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Exam name is required.');
  });

  it('allows duplicate exam names', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      exams: [
        { name: 'Mid 1', start: '2026-08-29', end: '2026-08-29', periodsPerDay: 2 },
        { name: 'mid 1', start: '2026-09-05', end: '2026-09-05', periodsPerDay: 2 },
      ],
    });
    expect(parsed.success).toBe(true);
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
      specialSaturdays: [{ date: '2026-12-26', copiedWeekday: 1 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Special Saturday dates must be inside the semester.');
  });

  it('rejects a special Saturday entry on a weekday', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      specialSaturdays: [{ date: '2026-07-06', copiedWeekday: 1 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Special Saturday dates must be Saturdays.');
  });

  it('rejects impossible calendar dates', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      holidays: [{ name: 'Invalid', start: '2026-02-30', end: '2026-02-30' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects PostgreSQL-incompatible year zero dates', () => {
    const parsed = semesterConfigSchema.safeParse({ ...baseConfig, semesterStart: '0000-01-01', semesterEnd: '0001-01-01' });
    expect(parsed.success).toBe(false);
  });

  it('rejects duplicate daily exam overrides', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      exams: [{ name: 'Exam', start: '2026-08-01', end: '2026-08-03', periodsPerDay: 2, dailyPeriods: [{ date: '2026-08-02', periodsPerDay: 2 }, { date: '2026-08-02', periodsPerDay: 4 }] }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects overlapping exams and timetable periods', () => {
    const parsed = semesterConfigSchema.safeParse({
      ...baseConfig,
      timetable: [{ weekday: 1, sequence: 1, start: '09:00', end: '10:00' }, { weekday: 1, sequence: 2, start: '09:30', end: '10:30' }],
      exams: [{ name: 'First', start: '2026-08-01', end: '2026-08-03', periodsPerDay: 2 }, { name: 'Second', start: '2026-08-03', end: '2026-08-04', periodsPerDay: 2 }],
    });
    expect(parsed.success).toBe(false);
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
