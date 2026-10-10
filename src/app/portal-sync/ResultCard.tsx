'use client';

import type { AttendanceResult } from '@/domain/attendance/types';
import { useCountUp } from '@/lib/use-count-up';

const DANGER_RATIO = 0.9;
const CAUTION_RATIO = 0.5;
type Tier = 'lime' | 'yellow' | 'orange' | 'red';

const TIER_STYLES: Record<Tier, string> = {
  lime: 'bg-lime text-lime-ink',
  yellow: 'bg-hero-yellow text-hero-yellow-ink',
  orange: 'bg-hero-orange text-hero-orange-ink',
  red: 'bg-hero-danger text-hero-danger-ink',
};
const TIER_LABELS: Record<Tier, string> = { lime: 'Safe', yellow: 'Careful', orange: 'Tight', red: 'Danger' };

function resultTier(result: AttendanceResult): Tier {
  const { recoveryTo75 } = result;
  const needsRecovery = (recoveryTo75.periodsRequired ?? 0) > 0;
  if (!needsRecovery) return result.maximumBunks === 0 ? 'yellow' : 'lime';
  if (recoveryTo75.reachable === false || recoveryTo75.periodsRequired === null || result.remainingPeriods === 0) return 'red';
  const ratio = recoveryTo75.periodsRequired / result.remainingPeriods;
  if (ratio > DANGER_RATIO) return 'red';
  if (ratio >= CAUTION_RATIO) return 'orange';
  return 'yellow';
}

/** The headline answer plus the numbers behind it. */
export function ResultCard({ result }: { result: AttendanceResult }) {
  const tier = resultTier(result);
  const needsRecovery = (result.recoveryTo75.periodsRequired ?? 0) > 0;
  const headline = needsRecovery ? (result.recoveryTo75.periodsRequired ?? 0) : result.maximumBunks;
  const shownHeadline = useCountUp(headline);

  return (
    <section aria-live="polite" className="card animate-pop overflow-hidden">
      <div className={`p-5 phone:p-6 ${TIER_STYLES[tier]}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="m-0 font-term text-[12px] font-bold">{needsRecovery ? 'Attendance recovery' : 'Your bunk budget'}</p>
          <span className="rounded-full border border-current px-2.5 py-0.5 font-term text-[11px] font-bold">{TIER_LABELS[tier]}</span>
        </div>
        <div className="heading text-[72px] leading-[.85] tabular-nums phone:text-[88px]">{Math.round(shownHeadline)}</div>
        <p className="m-0 mt-3 font-term text-[13px] leading-[1.45] font-bold">
          {needsRecovery ? (
            result.recoveryTo75.reachable ? (
              <>classes in a row to reach 75% (about {result.recoveryTo75.minimumCollegeDays} college days)</>
            ) : (
              <>Not reachable this semester — best finish is {result.recoveryTo75.bestAchievablePercentage.toFixed(2)}%</>
            )
          ) : (
            <>periods you can bunk and still land at {result.finalPercentageAtMaximumBunks.toFixed(2)}%</>
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-edge bg-edge phone:grid-cols-4">
        <Stat label="Held so far" value={result.heldSoFar} note={`${result.updatedCurrentPercentage.toFixed(2)}%`} />
        <Stat label="Periods left" value={result.remainingPeriods} note={`${result.teachingWeeks} teaching weeks`} />
        <Stat label="Days you can miss" value={result.maximumFullDaysAbsent} note="full days off" />
        <Stat label="Bunks per week" value={result.periodsPerWeek} decimals={1} note="on average" />
      </div>
    </section>
  );
}

function Stat({ label, value, note, decimals = 0 }: { label: string; value: number; note: string; decimals?: number }) {
  const shown = useCountUp(value);
  return (
    <div className="bg-paper p-3">
      <span className="eyebrow-text block text-[10px] text-muted">{label}</span>
      <strong className="heading mt-1 block text-[24px] tabular-nums">{shown.toFixed(decimals)}</strong>
      <small className="block font-term text-[11px] text-muted">{note}</small>
    </div>
  );
}
