import type { CalendarSummary, DatedPeriod, ScheduleConfig } from '../schedule/types';

export type AttendanceInput = {
  currentPercentage: number;
  targetPercentage: number;
  calendar: CalendarSummary;
};

export type RecoveryResult = {
  targetPercentage: number;
  /** Periods that must be attended to reach the target; null when unreachable. */
  periodsRequired: number | null;
  reachable: boolean;
  minimumCollegeDays: number | null;
  /** The date (YYYY-MM-DD) of the last class of the run you'd need to attend; null when nothing is needed or it is unreachable. */
  completesOn: string | null;
  bestAchievablePercentage: number;
};

export type AttendanceResult = {
  currentPercentage: number;
  /** Attendance after corrections to periods that have actually happened (past days and today). Excludes plans. */
  updatedCurrentPercentage: number;
  /**
   * Attendance on the last day you have planned something for, assuming you
   * attend every other class up to then and bunk exactly what you planned.
   * Equals updatedCurrentPercentage when nothing is planned.
   */
  projectedPercentage: number;
  /** The last planned day (YYYY-MM-DD) that projectedPercentage runs through; null when nothing is planned. */
  projectedThrough: string | null;
  /** Periods attended so far, fractional because the entered percentage is applied to periods held. */
  attendedSoFar: number;
  targetPercentage: number;
  /** Periods that have actually happened, including today's tagged ones. Excludes planned future periods. */
  heldSoFar: number;
  /** Periods the budget maths treats as decided: heldSoFar plus planned future periods. */
  heldPeriods: number;
  attendedPeriods: number;
  /** Future periods the student has already decided on (planned bunks or pinned attendance). */
  plannedPeriods: number;
  /** How many of those plans are bunks. */
  plannedBunks: number;
  remainingPeriods: number;
  maximumBunks: number;
  finalPercentageAtMaximumBunks: number;
  /** Whole regular college days (exam days excluded) the bunk budget covers, counted heaviest-first. */
  maximumFullDaysAbsent: number;
  periodsPerWeek: number;
  /** The teaching weeks (weeks with at least one non-exam period left) that periodsPerWeek is averaged over. */
  teachingWeeks: number;
  practicalBunksByWeek: number[];
  recoveryTo75: RecoveryResult;
  recoveryToTarget: RecoveryResult;
};

/** User override for a single period on a past day in the calendar. */
export type PeriodOverride = {
  date: string;       // YYYY-MM-DD
  sequence: number;   // 1-based period sequence
  status: 'attended' | 'bunked';
};

/** User input for a single completed/ongoing period on today. */
export type TodayPeriodInput = {
  sequence: number;
  /**
   * 'auto'     – already reflected in the portal percentage; engine skips it.
   * true       – attending (manually marked, not yet in portal).
   * false      – bunking  (manually marked, not yet in portal).
   */
  attending: boolean | 'auto';
};

/** Adjustments derived from user's calendar overrides and today's input. */
export type AttendanceAdjustments = {
  /** Per-period overrides for past days where attendance wasn't updated. */
  periodOverrides: PeriodOverride[];
  /** User's input for today's periods. */
  todayPeriods: TodayPeriodInput[];
};

export type CalculationRequest = Omit<AttendanceInput, 'calendar'> & {
  config: ScheduleConfig;
  now: Date;
  adjustments?: AttendanceAdjustments;
  /**
   * Exact held/attended counts from an authoritative source (the college
   * portal), replacing the calendar-derived count and the percentage-based
   * estimate. Provide both or neither. `currentPercentage` is still required
   * when these are omitted, and is ignored when they're present.
   */
  exactCounts?: { held: number; attended: number };
  /**
   * Exact future periods from an authoritative source (the college portal's
   * own timetable), replacing the calendar-derived future bucket. `config`
   * is still required (for `exams`, used to exclude exam days from "days you
   * can miss"/teaching-weeks the same way as always) but its `timetable`,
   * `holidays` and `specialSaturdays` go unused once this is provided.
   */
  futurePeriods?: DatedPeriod[];
};
