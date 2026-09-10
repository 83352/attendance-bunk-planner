import { buildCalendar } from '../schedule/calendar';
import type { DatedPeriod } from '../schedule/types';
import type {
  AttendanceResult,
  CalculationRequest,
  RecoveryResult,
} from './types';

const EPSILON = 1e-10;

function estimateAttendedPeriods(currentPercentage: number, heldPeriods: number): number {
  return (currentPercentage / 100) * heldPeriods;
}

function finalPercentageWithBunks(attended: number, held: number, future: number, bunks: number): number {
  const total = held + future;
  return total === 0 ? 0 : ((attended + future - bunks) / total) * 100;
}

function recoveryFor(
  targetPercentage: number,
  attended: number,
  held: number,
  futurePeriods: DatedPeriod[],
): RecoveryResult {
  const target = targetPercentage / 100;
  const bestAchievable = held + futurePeriods.length === 0
    ? 0
    : ((attended + futurePeriods.length) / (held + futurePeriods.length)) * 100;

  if (held > 0 && attended / held >= target - EPSILON) {
    return {
      targetPercentage,
      periodsRequired: 0,
      reachable: true,
      minimumCollegeDays: 0,
      bestAchievablePercentage: bestAchievable,
    };
  }

  if (target >= 1 - EPSILON) {
    const reachable = attended >= held - EPSILON;
    return {
      targetPercentage,
      periodsRequired: reachable ? 0 : null,
      reachable,
      minimumCollegeDays: reachable ? 0 : null,
      bestAchievablePercentage: bestAchievable,
    };
  }

  const required = Math.max(0, Math.ceil((target * held - attended) / (1 - target) - EPSILON));
  const reachable = required <= futurePeriods.length;
  let minimumCollegeDays: number | null = reachable ? 0 : null;
  if (reachable && required > 0) {
    let periodsSeen = 0;
    let collegeDays = 0;
    const dates = [...new Set(futurePeriods.map((period) => period.date))];
    const periodsByDate = new Map<string, number>();
    for (const period of futurePeriods) periodsByDate.set(period.date, (periodsByDate.get(period.date) ?? 0) + 1);
    for (const date of dates) {
      periodsSeen += periodsByDate.get(date) ?? 0;
      collegeDays += 1;
      if (periodsSeen >= required) break;
    }
    minimumCollegeDays = collegeDays;
  }

  return {
    targetPercentage,
    periodsRequired: required,
    reachable,
    minimumCollegeDays,
    bestAchievablePercentage: bestAchievable,
  };
}

/**
 * How many whole college days `budget` periods covers, taking the heaviest days
 * first. A day counts only if all of its periods fit.
 *
 * Heaviest-first makes the count hold whichever days actually get skipped: the
 * n it returns is the largest n whose n longest days still fit, so skipping any
 * n days in any combination stays inside the budget. Counting in calendar order
 * instead would report a larger number that only survives if days are skipped
 * roughly in order -- a student who skipped only their longest day each week
 * would run past the budget while the screen still said they were fine. This is
 * a debarment calculator, so it reports the floor rather than the likely case.
 */
function fullDaysWithinBudget(futurePeriods: DatedPeriod[], budget: number): number {
  if (budget <= 0) return 0;
  const periodsByDate = new Map<string, number>();
  for (const period of futurePeriods) periodsByDate.set(period.date, (periodsByDate.get(period.date) ?? 0) + 1);

  let spent = 0;
  let days = 0;
  for (const periodsThatDay of [...periodsByDate.values()].sort((a, b) => b - a)) {
    if (spent + periodsThatDay > budget) break;
    spent += periodsThatDay;
    days += 1;
  }
  return days;
}

function distributeBunks(totalBunks: number, weeks: number, weeklyPeriods: number[]): number[] {
  if (weeks === 0) return [];
  const result = Array.from({ length: weeks }, () => 0);
  let remaining = totalBunks;
  while (remaining > 0) {
    let placed = false;
    for (let index = 0; index < weeks && remaining > 0; index += 1) {
      if (result[index] < weeklyPeriods[index]) {
        result[index] += 1;
        remaining -= 1;
        placed = true;
      }
    }
    if (!placed) break;
  }
  return result;
}

export function calculateAttendance(request: CalculationRequest): AttendanceResult {
  if (!Number.isFinite(request.currentPercentage) || request.currentPercentage < 0 || request.currentPercentage > 100) {
    throw new RangeError('Current attendance must be between 0 and 100.');
  }
  if (!Number.isFinite(request.targetPercentage) || request.targetPercentage < 0 || request.targetPercentage > 100) {
    throw new RangeError('Target attendance must be between 0 and 100.');
  }
  const calendar = buildCalendar(request.config, request.now);
  const heldPeriods = calendar.heldThroughYesterday.length;
  const attendedPeriods = estimateAttendedPeriods(request.currentPercentage, heldPeriods);
  const remainingPeriods = calendar.future.length;
  const target = request.targetPercentage / 100;
  const maximumBunks = Math.max(
    0,
    Math.min(remainingPeriods, Math.floor(attendedPeriods + remainingPeriods - target * (heldPeriods + remainingPeriods) + EPSILON)),
  );
  const weeklyPeriods = [...calendar.futureByWeek.values()].map((periods) => periods.length);
  const practicalBunksByWeek = distributeBunks(maximumBunks, weeklyPeriods.length, weeklyPeriods);

  return {
    currentPercentage: request.currentPercentage,
    targetPercentage: request.targetPercentage,
    heldPeriods,
    attendedPeriods,
    remainingPeriods,
    maximumBunks,
    finalPercentageAtMaximumBunks: finalPercentageWithBunks(attendedPeriods, heldPeriods, remainingPeriods, maximumBunks),
    maximumFullDaysAbsent: fullDaysWithinBudget(calendar.future, maximumBunks),
    periodsPerWeek: weeklyPeriods.length === 0 ? 0 : maximumBunks / weeklyPeriods.length,
    practicalBunksByWeek,
    recoveryTo75: recoveryFor(75, attendedPeriods, heldPeriods, calendar.future),
    recoveryToTarget: recoveryFor(request.targetPercentage, attendedPeriods, heldPeriods, calendar.future),
  };
}
