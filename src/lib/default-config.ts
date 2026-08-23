import type { ScheduleConfig, TimetablePeriod, Weekday } from '@/domain/schedule/types';

const weekdayTimings: Record<Weekday, string[]> = {
  0: [],
  1: ['09:10-10:10', '10:10-11:10', '11:15-12:15', '13:00-15:00', '15:05-16:05'],
  2: ['09:10-10:10', '10:10-11:10', '11:15-12:15', '13:00-14:00', '14:00-15:00', '15:05-16:05'],
  3: ['09:10-11:10', '11:15-12:15', '13:00-14:00', '14:00-15:00', '15:05-16:05'],
  4: ['09:10-11:10', '11:15-12:15', '13:00-14:00', '14:00-15:00', '15:05-16:05'],
  5: ['09:10-10:10', '10:10-11:10', '11:15-12:15', '13:00-15:00', '15:05-16:05'],
  6: [],
};

const timetable: TimetablePeriod[] = (Object.entries(weekdayTimings) as [string, string[]][]).flatMap(([weekday, timings]) =>
  timings.map((time, index) => {
    const [start, end] = time.split('-');
    return { weekday: Number(weekday) as Weekday, sequence: index + 1, start, end };
  }),
);

export const defaultConfig: ScheduleConfig = {
  semesterStart: '2026-07-06',
  semesterEnd: '2026-11-07',
  timetable,
  holidays: [],
  specialSaturdays: [{ date: '2026-07-25', copiedWeekday: 1 }],
  exams: [
    { name: 'Mid 1', start: '2026-08-31', end: '2026-09-03', periodsPerDay: 2, dailyPeriods: [] },
    { name: 'Mid 2', start: '2026-11-02', end: '2026-11-05', periodsPerDay: 2, dailyPeriods: [] },
  ],
};
