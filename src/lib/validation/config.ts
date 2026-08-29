import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.');

export const timetablePeriodSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  sequence: z.number().int().positive(),
  start: timeSchema,
  end: timeSchema,
}).refine((period) => period.start < period.end, 'Period end must be after its start.');

export const holidaySchema = z.object({ name: z.string().trim().min(1).max(100), start: dateSchema, end: dateSchema }).refine((item) => item.start <= item.end, 'Holiday end must be on or after its start.');
export const specialSaturdaySchema = z.object({ date: dateSchema, copiedWeekday: z.number().int().min(1).max(5) });
export const examSchema = z.object({ name: z.string().trim().min(1, 'Exam name is required.').max(80, 'Exam name must be 80 characters or fewer.'), start: dateSchema, end: dateSchema, periodsPerDay: z.union([z.literal(2), z.literal(4)]), dailyPeriods: z.array(z.object({ date: dateSchema, periodsPerDay: z.union([z.literal(2), z.literal(4)]) })).optional() }).refine((item) => item.start <= item.end, 'Exam end must be on or after its start.').refine((item) => (item.dailyPeriods ?? []).every((day) => day.date >= item.start && day.date <= item.end), 'Daily exam overrides must be inside the exam range.');

export const semesterConfigSchema = z.object({
  semesterStart: dateSchema,
  semesterEnd: dateSchema,
  timetable: z.array(timetablePeriodSchema),
  holidays: z.array(holidaySchema),
  specialSaturdays: z.array(specialSaturdaySchema),
  exams: z.array(examSchema),
}).refine((config) => config.semesterStart <= config.semesterEnd, 'Semester end must be on or after its start.')
  .refine(
    (config) => config.exams.every((exam) => exam.start >= config.semesterStart && exam.end <= config.semesterEnd),
    'Exam dates must be inside the semester.',
  )
  .refine(
    (config) => config.exams.length === new Set(config.exams.map((exam) => exam.name.trim().toLowerCase())).size,
    'Each exam name must be unique.',
  )
  .refine(
    (config) => config.holidays.every((holiday) => holiday.start >= config.semesterStart && holiday.end <= config.semesterEnd),
    'Holiday dates must be inside the semester.',
  )
  .refine(
    (config) => config.specialSaturdays.length === new Set(config.specialSaturdays.map((special) => special.date)).size,
    'Each special Saturday can only be listed once.',
  )
  .refine(
    (config) => config.specialSaturdays.every((special) => special.date >= config.semesterStart && special.date <= config.semesterEnd),
    'Special Saturday dates must be inside the semester.',
  );
