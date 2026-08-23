export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimetablePeriod = {
  weekday: Weekday;
  sequence: number;
  start: string;
  end: string;
};

export type Holiday = {
  name: string;
  start: string;
  end: string;
};

export type SpecialSaturday = {
  date: string;
  copiedWeekday: Weekday;
};

export type ExamPeriod = {
  name: 'Mid 1' | 'Mid 2';
  start: string;
  end: string;
  periodsPerDay: 2 | 4;
  dailyPeriods?: { date: string; periodsPerDay: 2 | 4 }[];
};

export type ScheduleConfig = {
  semesterStart: string;
  semesterEnd: string;
  timetable: TimetablePeriod[];
  holidays: Holiday[];
  specialSaturdays: SpecialSaturday[];
  exams: ExamPeriod[];
};

export type DatedPeriod = TimetablePeriod & { date: string };

export type CalendarSummary = {
  heldThroughYesterday: DatedPeriod[];
  today: DatedPeriod[];
  future: DatedPeriod[];
  futureByWeek: Map<string, DatedPeriod[]>;
};
