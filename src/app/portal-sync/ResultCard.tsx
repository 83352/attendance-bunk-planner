'use client';

import type { AttendanceResult } from '@/domain/attendance/types';
import { useCountUp } from '@/lib/use-count-up';
import { InfoTip } from '../InfoTip';
import type { Tier } from './result-tier';

const TIER_STYLES: Record<Tier, string> = {
  lime: 'bg-lime text-lime-ink',
  yellow: 'bg-hero-yellow text-hero-yellow-ink',
  orange: 'bg-hero-orange text-hero-orange-ink',
  red: 'bg-hero-danger text-hero-danger-ink',
};
const TIER_LABELS: Record<Tier, string> = { lime: 'Safe', yellow: 'Careful', orange: 'Tight', red: 'Danger' };
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Explains the days-you-can-miss range in terms of this student's own remaining timetable. */
function daysRangeTip(result: AttendanceResult): string {
  const { min, max } = result.fullDaysRange;
  const load = result.weekdayLoad;
  if (load.length === 0) return 'There are no regular college days left to count.';
  const longest = load.reduce((best, day) => (day.periods > best.periods ? day : best));
  const shortest = load.reduce((best, day) => (day.periods < best.periods ? day : best));
  if (min === max) {
    return `Every day you have left is about the same length, so ${result.maximumBunks} bunks cover ${min} full ${min === 1 ? 'day' : 'days'} whichever days you skip.`;
  }
  return `It depends on which days you skip. Your longest day is ${WEEKDAY_NAMES[longest.weekday]} (${longest.periods} periods) and your shortest is ${WEEKDAY_NAMES[shortest.weekday]} (${shortest.periods}). Skipping the longest days first uses your ${result.maximumBunks} bunks up fastest: ${min} full ${min === 1 ? 'day' : 'days'}. Skipping the shortest first stretches them to ${max}. Based on the classes left in your timetable, not counting exam days.`;
}

/** The headline answer plus the numbers behind it. `tier` is judged against 75%, whatever target was typed. */
export function ResultCard({ result, tier }: { result: AttendanceResult; tier: Tier }) {
  const target = result.targetPercentage;
  // Below the typed target: the useful number is how many classes in a row get you there.
  const needsRecovery = (result.recoveryToTarget.periodsRequired ?? 0) > 0;
  const recovery = result.recoveryToTarget;
  const headline = needsRecovery ? (recovery.periodsRequired ?? 0) : result.maximumBunks;
  const shownHeadline = useCountUp(headline);
  const { min, max } = result.fullDaysRange;

  return (
    <section aria-live="polite" className="card animate-pop">
      <div className={`p-5 phone:p-6 ${TIER_STYLES[tier]}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="m-0 font-term text-[13px] font-bold">{needsRecovery ? 'Attendance recovery' : 'Your bunk budget'}</p>
          <span className="rounded-full border border-current px-2.5 py-0.5 font-term text-[12px] font-bold">{TIER_LABELS[tier]}</span>
        </div>
        <div className="heading text-[72px] leading-[.85] tabular-nums phone:text-[88px]">{Math.round(shownHeadline)}</div>
        <p className="m-0 mt-3 font-term text-[14px] leading-[1.45] font-bold">
          {needsRecovery ? (
            recovery.reachable ? (
              <>classes in a row to reach {target}% (about {recovery.minimumCollegeDays} college days)</>
            ) : (
              <>Not reachable this semester — best finish is {recovery.bestAchievablePercentage.toFixed(2)}%</>
            )
          ) : (
            <>periods you can bunk and still land at {result.finalPercentageAtMaximumBunks.toFixed(2)}%</>
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-edge bg-edge phone:grid-cols-4">
        <Stat label="Held so far" value={<Count value={result.heldSoFar} />} note={`${result.updatedCurrentPercentage.toFixed(2)}%`} />
        <Stat
          label="Periods left"
          value={<Count value={result.regularRemainingPeriods} />}
          note={result.examPeriodsRemaining > 0 ? `+${result.examPeriodsRemaining} exam periods` : `${result.teachingWeeks} teaching weeks`}
        />
        <Stat
          label="Days you can miss"
          value={min === max ? <Count value={min} /> : <><Count value={min} />–<Count value={max} /></>}
          note="full days off"
          tip={<InfoTip label="How days you can miss is worked out">{daysRangeTip(result)}</InfoTip>}
        />
        <Stat label="Bunks per week" value={<Count value={result.periodsPerWeek} decimals={1} />} note="on average" />
      </div>
    </section>
  );
}

function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  return <>{useCountUp(value).toFixed(decimals)}</>;
}

function Stat({ label, value, note, tip }: { label: string; value: React.ReactNode; note: string; tip?: React.ReactNode }) {
  return (
    <div className="bg-paper p-3">
      <span className="eyebrow-text flex items-center gap-1.5 text-[12px] text-muted">{label}{tip}</span>
      <strong className="heading mt-1 block text-[24px] tabular-nums">{value}</strong>
      <small className="block font-term text-[12px] text-muted">{note}</small>
    </div>
  );
}
