import type { CalendarSummary, ScheduleConfig } from '../schedule/types';

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
  bestAchievablePercentage: number;
};

export type AttendanceResult = {
  currentPercentage: number;
  updatedCurrentPercentage: number;
  targetPercentage: number;
  heldPeriods: number;
  attendedPeriods: number;
  remainingPeriods: number;
  maximumBunks: number;
  finalPercentageAtMaximumBunks: number;
  /** Whole college days the bunk budget covers, counted forward from the next one. */
  maximumFullDaysAbsent: number;
  periodsPerWeek: number;
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

/** User input for a single period on today. */
export type TodayPeriodInput = {
  sequence: number;
  attending: boolean;  // true = attending (default), false = bunking
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
};
