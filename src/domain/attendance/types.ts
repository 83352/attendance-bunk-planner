import type { CalendarSummary, ScheduleConfig } from '../schedule/types';

export type AttendanceInput = {
  currentPercentage: number;
  targetPercentage: number;
  calendar: CalendarSummary;
};

export type RecoveryResult = {
  targetPercentage: number;
  periodsRequired: number;
  reachable: boolean;
  minimumCollegeDays: number | null;
  bestAchievablePercentage: number;
};

export type AttendanceResult = {
  currentPercentage: number;
  targetPercentage: number;
  heldPeriods: number;
  attendedPeriods: number;
  remainingPeriods: number;
  maximumBunks: number;
  finalPercentageAtMaximumBunks: number;
  periodsPerWeek: number;
  practicalBunksByWeek: number[];
  recoveryTo75: RecoveryResult;
  recoveryToTarget: RecoveryResult;
};

export type CalculationRequest = Omit<AttendanceInput, 'calendar'> & {
  config: ScheduleConfig;
  now: Date;
};
