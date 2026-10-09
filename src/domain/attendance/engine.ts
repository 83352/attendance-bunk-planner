import { buildCalendar, dateInRange } from '../schedule/calendar';
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
      completesOn: null,
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
      completesOn: null,
      bestAchievablePercentage: bestAchievable,
    };
  }

  const required = Math.max(0, Math.ceil((target * held - attended) / (1 - target) - EPSILON));
  const reachable = required <= futurePeriods.length;
  let minimumCollegeDays: number | null = reachable ? 0 : null;
  let completesOn: string | null = null;
  if (reachable && required > 0) {
    let periodsSeen = 0;
    let collegeDays = 0;
    const dates = [...new Set(futurePeriods.map((period) => period.date))];
    const periodsByDate = new Map<string, number>();
    for (const period of futurePeriods) periodsByDate.set(period.date, (periodsByDate.get(period.date) ?? 0) + 1);
    for (const date of dates) {
      periodsSeen += periodsByDate.get(date) ?? 0;
      collegeDays += 1;
      if (periodsSeen >= required) {
        completesOn = date;
        break;
      }
    }
    minimumCollegeDays = collegeDays;
  }

  return {
    targetPercentage,
    periodsRequired: required,
    reachable,
    minimumCollegeDays,
    completesOn,
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
  // An authoritative source (the portal) overrides the timetable's own count
  // of periods held so far — the two don't always agree (labs, activity
  // sessions, etc. the timetable doesn't model), and the portal is the one
  // that's actually graded against.
  let heldPeriods = request.exactCounts ? request.exactCounts.held : calendar.heldThroughYesterday.length;
  let attendedPeriods = request.exactCounts ? request.exactCounts.attended : estimateAttendedPeriods(request.currentPercentage, heldPeriods);


  let futurePeriods = [...calendar.future];
  // Future periods the student has already decided on. They are counted in the
  // budget maths but are NOT "held so far": they haven't happened yet.
  let plannedPeriods = 0;
  let plannedAttended = 0;
  let lastPlannedDate: string | null = null;

  // Apply calendar overrides for past periods whose attendance wasn't updated.
  // The entered % is applied to all held periods naively. Each overridden period
  // was implicitly counted as (currentPercentage / 100) attended. Marking it as
  // "attended" means it's actually 1.0 → delta = +(1 - %/100).
  // Marking it as "bunked" means it's actually 0.0 → delta = -(% /100).
  if (request.adjustments) {
    const pct = request.currentPercentage / 100;
    const futureOverrides = new Map<string, 'attended' | 'bunked'>();

    for (const override of request.adjustments.periodOverrides) {
      // Check if this override is for a future period
      const isFuture = calendar.future.some(p => p.date === override.date && p.sequence === override.sequence);
      if (isFuture) {
        futureOverrides.set(`${override.date}:${override.sequence}`, override.status);
      } else {
        if (override.status === 'attended') {
          attendedPeriods += (1 - pct);
        } else {
          attendedPeriods -= pct;
        }
      }
    }

    if (futureOverrides.size > 0) {
      const remainingFuture: DatedPeriod[] = [];
      for (const p of calendar.future) {
        const status = futureOverrides.get(`${p.date}:${p.sequence}`);
        if (status) {
          heldPeriods += 1;
          plannedPeriods += 1;
          if (lastPlannedDate === null || p.date > lastPlannedDate) lastPlannedDate = p.date;
          if (status === 'attended') {
            attendedPeriods += 1;
            plannedAttended += 1;
          }
        } else {
          remainingFuture.push(p);
        }
      }
      futurePeriods = remainingFuture;
    }

    // Today's completed/ongoing periods: move from excluded "today" bucket into
    // held/attended. Periods marked 'auto' are already reflected in the portal
    // percentage, so we just add their fractional percentage to keep the ratio
    // identical while correctly incrementing the total held periods "as of now".
    for (const todayPeriod of request.adjustments.todayPeriods) {
      heldPeriods += 1;
      if (todayPeriod.attending === 'auto') {
        attendedPeriods += pct;
      } else if (todayPeriod.attending) {
        attendedPeriods += 1;
      }
    }
  }

  // Clamp attended to [0, held] to prevent nonsensical results from edge cases.
  attendedPeriods = Math.max(0, Math.min(attendedPeriods, heldPeriods));

  const remainingPeriods = futurePeriods.length;
  const heldSoFar = heldPeriods - plannedPeriods;
  const attendedSoFar = Math.max(0, Math.min(attendedPeriods - plannedAttended, heldSoFar));

  // Projection through the last planned day: every class up to then is
  // attended except the planned bunks, so "attend tomorrow, bunk the day
  // after" counts both days.
  const plannedBunkCount = plannedPeriods - plannedAttended;
  const periodsThroughLastPlan = lastPlannedDate === null ? 0 : calendar.future.filter((p) => p.date <= (lastPlannedDate as string)).length;
  const projectedHeld = heldSoFar + periodsThroughLastPlan;
  const projectedAttended = attendedSoFar + periodsThroughLastPlan - plannedBunkCount;

  const target = request.targetPercentage / 100;
  const maximumBunks = Math.max(
    0,
    Math.min(remainingPeriods, Math.floor(attendedPeriods + remainingPeriods - target * (heldPeriods + remainingPeriods) + EPSILON)),
  );
  
  // Exam days are not skippable: they never count as a regular week and never
  // as a "day you can miss". (Their periods still sit in the bunk budget.)
  const isExamDay = (date: string) => request.config.exams.some((exam) => dateInRange(date, exam.start, exam.end));
  const regularFuturePeriods = futurePeriods.filter((period) => !isExamDay(period.date));

  const futureByWeek = new Map<string, DatedPeriod[]>();
  for (const period of regularFuturePeriods) {
    const current = new Date(`${period.date}T00:00:00Z`);
    const offset = (current.getUTCDay() + 6) % 7;
    current.setUTCDate(current.getUTCDate() - offset);
    const key = current.toISOString().slice(0, 10);
    const list = futureByWeek.get(key) ?? [];
    list.push(period);
    futureByWeek.set(key, list);
  }
  
  const weeklyPeriods = [...futureByWeek.values()].map((periods) => periods.length);
  const practicalBunksByWeek = distributeBunks(maximumBunks, weeklyPeriods.length, weeklyPeriods);

  return {
    currentPercentage: request.currentPercentage,
    updatedCurrentPercentage: heldSoFar === 0 ? 0 : (attendedSoFar / heldSoFar) * 100,
    projectedPercentage: projectedHeld === 0 ? 0 : (Math.max(0, projectedAttended) / projectedHeld) * 100,
    projectedThrough: lastPlannedDate,
    attendedSoFar,
    targetPercentage: request.targetPercentage,
    heldSoFar,
    heldPeriods,
    attendedPeriods,
    plannedPeriods,
    plannedBunks: plannedPeriods - plannedAttended,
    remainingPeriods,
    maximumBunks,
    finalPercentageAtMaximumBunks: finalPercentageWithBunks(attendedPeriods, heldPeriods, remainingPeriods, maximumBunks),
    maximumFullDaysAbsent: fullDaysWithinBudget(regularFuturePeriods, maximumBunks),
    periodsPerWeek: weeklyPeriods.length === 0 ? 0 : maximumBunks / weeklyPeriods.length,
    teachingWeeks: weeklyPeriods.length,
    practicalBunksByWeek,
    recoveryTo75: recoveryFor(75, attendedPeriods, heldPeriods, futurePeriods),
    recoveryToTarget: recoveryFor(request.targetPercentage, attendedPeriods, heldPeriods, futurePeriods),
  };
}
