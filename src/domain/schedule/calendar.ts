import type {
  CalendarSummary,
  DatedPeriod,
  ExamPeriod,
  ScheduleConfig,
  TimetablePeriod,
  Weekday,
} from './types';

const TIME_ZONE = 'Asia/Kolkata';
const timetableCache = new WeakMap<object, Map<Weekday, TimetablePeriod[]>>();

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weekdayOf(date: string): Weekday {
  return parseDate(date).getUTCDay() as Weekday;
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = parseDate(start); date <= parseDate(end); date = addDays(date, 1)) {
    dates.push(formatDate(date));
  }
  return dates;
}

export function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function timetableFor(config: ScheduleConfig, weekday: Weekday): TimetablePeriod[] {
  let byWeekday = timetableCache.get(config);
  if (!byWeekday) {
    byWeekday = new Map();
    for (const period of config.timetable) byWeekday.set(period.weekday, [...(byWeekday.get(period.weekday) ?? []), period]);
    for (const periods of byWeekday.values()) periods.sort((a, b) => a.sequence - b.sequence);
    timetableCache.set(config, byWeekday);
  }
  return byWeekday.get(weekday) ?? [];
}

function examFor(config: ScheduleConfig, date: string): ExamPeriod | undefined {
  return config.exams.find((exam) => dateInRange(date, exam.start, exam.end));
}

export function periodsForDate(config: ScheduleConfig, date: string): DatedPeriod[] {
  if (config.holidays.some((holiday) => dateInRange(date, holiday.start, holiday.end))) {
    return [];
  }

  const exam = examFor(config, date);
  if (exam) {
    const dailyOverride = exam.dailyPeriods?.find((item) => item.date === date);
    const periodsPerDay = dailyOverride?.periodsPerDay ?? exam.periodsPerDay;
    return Array.from({ length: periodsPerDay }, (_, index) => ({
      date,
      weekday: weekdayOf(date),
      sequence: index + 1,
      start: '00:00',
      end: '23:59',
    }));
  }

  const weekday = weekdayOf(date);
  const specialSaturday = config.specialSaturdays.find((special) => special.date === date);
  const sourceWeekday = specialSaturday ? specialSaturday.copiedWeekday : weekday;

  return timetableFor(config, sourceWeekday).map((period) => ({ ...period, date }));
}

function istDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function mondayWeekKey(date: string): string {
  const current = parseDate(date);
  const offset = (current.getUTCDay() + 6) % 7;
  return formatDate(addDays(current, -offset));
}

export function buildCalendar(config: ScheduleConfig, now: Date): CalendarSummary {
  const today = istDate(now);
  const heldThroughYesterday: DatedPeriod[] = [];
  const todayPeriods: DatedPeriod[] = [];
  const future: DatedPeriod[] = [];
  const futureByWeek = new Map<string, DatedPeriod[]>();

  for (const date of datesBetween(config.semesterStart, config.semesterEnd)) {
    const periods = periodsForDate(config, date);
    if (date < today) heldThroughYesterday.push(...periods);
    else if (date === today) todayPeriods.push(...periods);
    else {
      future.push(...periods);
      if (periods.length > 0) {
        const key = mondayWeekKey(date);
        futureByWeek.set(key, [...(futureByWeek.get(key) ?? []), ...periods]);
      }
    }
  }

  return { heldThroughYesterday, today: todayPeriods, future, futureByWeek };
}

export function currentIstDate(now: Date): string {
  return istDate(now);
}
