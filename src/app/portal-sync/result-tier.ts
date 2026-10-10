import type { AttendanceResult } from '@/domain/attendance/types';

const DANGER_RATIO = 0.9;
const CAUTION_RATIO = 0.5;

export type Tier = 'lime' | 'yellow' | 'orange' | 'red';

/**
 * How worried to look. Always measured against 75% (the usual debarment line),
 * never against whatever target the student typed: pass the result calculated
 * at a 75% target.
 */
export function resultTier(resultAt75: AttendanceResult): Tier {
  const { recoveryTo75 } = resultAt75;
  const needsRecovery = (recoveryTo75.periodsRequired ?? 0) > 0;
  if (!needsRecovery) return resultAt75.maximumBunks === 0 ? 'yellow' : 'lime';
  if (recoveryTo75.reachable === false || recoveryTo75.periodsRequired === null || resultAt75.remainingPeriods === 0) return 'red';
  const ratio = recoveryTo75.periodsRequired / resultAt75.remainingPeriods;
  if (ratio > DANGER_RATIO) return 'red';
  if (ratio >= CAUTION_RATIO) return 'orange';
  return 'yellow';
}

/** The tier for a student, given a way to run the maths at any target: always runs it at 75%, whatever target was typed. */
export function tierFor(calculateAt: (targetPercentage: number) => AttendanceResult): Tier {
  return resultTier(calculateAt(75));
}
