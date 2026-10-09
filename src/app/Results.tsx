'use client';

import { useEffect, useRef, useState } from 'react';
import type { AttendanceResult, RecoveryResult } from '@/domain/attendance/types';
import { prefersReducedMotion } from '@/lib/motion';

/** Display value of a number that eases up on first show and glides when it changes. */
function useCountUp(end: number | string, duration = 1200): number | string {
  const [count, setCount] = useState(0);
  // What is on screen right now, so a later change glides from there instead
  // of restarting at 0 (live recalculation re-renders on every keystroke).
  const shown = useRef(0);
  const numericEnd = typeof end === 'string' ? parseFloat(end) : end;

  useEffect(() => {
    if (Number.isNaN(numericEnd)) return;
    if (prefersReducedMotion()) {
      shown.current = numericEnd;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(numericEnd);
      return;
    }
    const from = shown.current;
    const span = from === 0 ? duration : 350;
    let startTimestamp: number | null = null;
    let frame = 0;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / span, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); // easeOutExpo
      const value = from + (numericEnd - from) * ease;
      shown.current = value;
      setCount(value);
      if (progress < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [numericEnd, duration]);

  if (Number.isNaN(numericEnd)) return end;
  if (typeof end === 'string' && end.includes('.')) return count.toFixed(1);
  return Math.round(count);
}

/**
 * An animated number that is safe for everyone: sighted users see it count,
 * while assistive tech and screenshots-in-flight always get the settled value.
 */
function CountUp({ value }: { value: number | string }) {
  const animated = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{animated}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}

const percentage = (value: number) => `${value.toFixed(2)}%`;
// Bunks per week divides into however many teaching weeks are left, so it is
// rarely a whole number. One decimal, with a bare integer when it is exact.
const perWeek = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateLabel = (iso: string) => dateFormatter.format(new Date(`${iso}T00:00:00Z`));

export function resultAnnouncement(result: AttendanceResult): string {
  const required = result.recoveryTo75.periodsRequired ?? 0;
  if (result.recoveryTo75.reachable === false) {
    return `Recovery to 75 percent is out of reach. Even attending everything leaves you at ${percentage(result.recoveryTo75.bestAchievablePercentage)}.`;
  }
  if (required > 0) {
    const until = result.recoveryTo75.completesOn ? ` Don't bunk anything until ${dateLabel(result.recoveryTo75.completesOn)}.` : '';
    return `You need to attend ${required} classes in a row to reach 75 percent.${until}`;
  }
  if (result.targetPercentage !== 75 && result.recoveryToTarget.reachable === false) {
    return `Your ${result.targetPercentage} percent target can't be reached. Even attending every remaining period you will finish at ${percentage(result.recoveryToTarget.bestAchievablePercentage)}.`;
  }
  return `You can bunk ${result.maximumBunks} periods this semester and still land at ${percentage(result.finalPercentageAtMaximumBunks)}.`;
}

const DANGER_ATTENDANCE_RATIO = 0.9;
const CAUTION_ATTENDANCE_RATIO = 0.5;

type ResultTier = 'lime' | 'yellow' | 'orange' | 'red';

// Result hero severity: lime (safe) -> yellow (recoverable, or zero bunks
// left but still on track) -> orange (recovery is tight, or a custom target
// that can't be reached) -> red (75% unreachable or recovery needs 90%+ of
// everything left). Recovery tiers are keyed ONLY on the fixed 75% recovery
// figure (recoveryTo75): a student who has already cleared 75% but is behind
// a stricter personal goal still gets lime/yellow, unless that goal can't be
// reached at all.
const TIER_STYLES: Record<ResultTier, string> = {
  lime: 'bg-lime text-[#14261c]',
  yellow: 'bg-hero-yellow text-hero-yellow-ink',
  orange: 'bg-hero-orange text-hero-orange-ink',
  red: 'bg-hero-danger text-hero-danger-ink',
};

function resultTier(result: AttendanceResult, needsRecoveryTo75: boolean, targetUnreachable: boolean): ResultTier {
  if (!needsRecoveryTo75) {
    if (targetUnreachable) return 'orange';
    return result.maximumBunks === 0 ? 'yellow' : 'lime';
  }
  const { recoveryTo75 } = result;
  if (recoveryTo75.reachable === false || recoveryTo75.periodsRequired === null || result.remainingPeriods === 0) return 'red';
  const ratio = recoveryTo75.periodsRequired / result.remainingPeriods;
  if (ratio > DANGER_ATTENDANCE_RATIO) return 'red';
  if (ratio >= CAUTION_ATTENDANCE_RATIO) return 'orange';
  return 'yellow';
}

type ResultsProps = {
  result: AttendanceResult;
  /** Semester end date, YYYY-MM-DD. */
  endDate: string;
  /** How many of today's periods are already counted in "held so far". */
  todayCounted: number;
};

export function Results({ result, endDate, todayCounted }: ResultsProps) {
  const { recoveryTo75 } = result;

  const unreachable = recoveryTo75.reachable === false;
  // A custom target (not the fixed 75% floor) that even perfect attendance can't reach.
  const targetUnreachable = !unreachable && result.targetPercentage !== 75 && result.recoveryToTarget.reachable === false;
  // Whether Recovery mode is SHOWN AT ALL considers both the fixed 75% floor
  // and a custom target. When recovery to 75% is flat-out unreachable the
  // engine's periodsRequired is just a number bigger than the periods left,
  // which would render a nonsensical "N classes" box next to the hero's own
  // "out of reach" message, so the whole section is skipped in that case.
  const recoveryVisible = !unreachable && ((result.recoveryTo75.periodsRequired ?? 0) > 0 || (result.recoveryToTarget.periodsRequired ?? 0) > 0);
  const recoveryLeadsPage = (result.recoveryTo75.periodsRequired ?? 0) > 0;
  const tier = resultTier(result, recoveryLeadsPage, targetUnreachable);
  const isDanger = tier === 'red';

  // One plain-language line per colour, so the colour never has to be decoded.
  // Only the states that need a word of warning get a line; the happy path stays quiet.
  const status = (() => {
    if (unreachable) return '75% is out of reach this semester';
    if (isDanger) return 'Danger: you need almost every remaining class';
    if (recoveryLeadsPage) return tier === 'orange' ? 'Behind: getting back to 75% will be tight' : null;
    if (targetUnreachable) return 'Your target is out of reach';
    if (result.maximumBunks === 0) return 'On the line: no bunks to spare';
    return null;
  })();
  const statusLine = status ? <p className="relative z-[1] m-0 mb-3 font-term text-[12px] leading-[1.3] font-bold">{status}</p> : null;

  // Styled like the hero (same border/shadow/padding language). When it
  // leads the page it also shares the hero's tier color, so the two boxes
  // read as one urgent unit; when it only trails (custom-target-only case)
  // it stays a neutral paper box, since that case isn't meant to alarm.
  const recoveryBlock = recoveryVisible && (
    <div className={`grid grid-cols-1 gap-[18px] px-5 pt-[22px] pb-[22px] phone:px-[17px] phone:pt-5 phone:pb-5 ${recoveryLeadsPage ? TIER_STYLES[tier] : 'border-[3px] border-black shadow-hard bg-paper text-black'}`}>
      <h2 className={`m-0 font-term text-[12px] leading-[1.4] ${recoveryLeadsPage ? 'font-bold' : 'text-muted'}`}><span className="eyebrow-text">Attendance Recovery</span></h2>
      {recoveryLeadsPage ? (
        <div>
          <div className="font-display text-[88px] leading-[.8] font-black uppercase tracking-[-2px] phone:text-[clamp(74px,24vw,100px)]"><CountUp value={result.recoveryTo75.periodsRequired ?? 0} /></div>
          <h3 className="mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">classes in a row</h3>
          <p className="m-0 font-term text-[13px] leading-[1.4] font-bold">
            {result.recoveryTo75.completesOn
              ? <>Don&apos;t bunk anything until <strong>{dateLabel(result.recoveryTo75.completesOn)}</strong> ({result.recoveryTo75.minimumCollegeDays} college days) to get back to 75%.</>
              : <>Attend about <strong>{result.recoveryTo75.minimumCollegeDays} college days</strong> in a row to reach 75%.</>}
          </p>
        </div>
      ) : (
        <RecoveryCard recovery={result.recoveryTo75} label="To reach 75%" />
      )}
      {result.targetPercentage !== 75 && (
        <RecoveryCard recovery={result.recoveryToTarget} label={`To reach ${percentage(result.targetPercentage)}`} />
      )}
    </div>
  );

  // Shared between the merged (recovery-leads) and standalone hero
  // renderings below, so the two never drift out of sync.
  const heroContent = (
    <>
      <div className="relative z-[1] font-display text-[88px] leading-[.8] font-black uppercase tracking-[-2px] phone:text-[clamp(74px,24vw,100px)]"><CountUp value={result.maximumBunks} /></div>
      <h2 className="relative z-[1] mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">{isDanger || targetUnreachable ? 'periods you can bunk' : 'periods you can bunk this sem'}</h2>
      {isDanger ? (
        <p className="relative z-[1] m-0 font-term text-[13px] leading-[1.4] font-bold">{unreachable ? 'Recovery is out of reach: ' : "You're in deep trouble: "}even attending everything leaves you at <strong>{percentage(recoveryTo75.bestAchievablePercentage)}</strong> vs the 75% bar.</p>
      ) : targetUnreachable ? (
        <p className="relative z-[1] m-0 font-term text-[13px] leading-[1.4] font-bold">Your {result.targetPercentage}% target can&apos;t be reached: even attending every remaining period, you&apos;ll finish at <strong>{percentage(result.recoveryToTarget.bestAchievablePercentage)}</strong>.</p>
      ) : (
        <>
          <p className="relative z-[1] m-0 font-term text-[13px] leading-[1.4] font-bold">and still land at <strong>{percentage(result.finalPercentageAtMaximumBunks)}</strong></p>
          <p className="relative z-[1] mt-2 mb-0 font-term text-[12px] leading-[1.4] font-bold">
            Assumes you attend every other class.
            {result.plannedBunks > 0 && <> Your {result.plannedBunks} planned bunk{result.plannedBunks === 1 ? ' is' : 's are'} already taken out of this.</>}
          </p>
        </>
      )}
      <span className="absolute right-[7%] bottom-[-70px] size-[180px] rounded-full border-[30px] border-white/25" aria-hidden="true" />
    </>
  );

  const tileTitle = 'block font-display text-[14px] leading-[1.1] font-black uppercase text-black';
  const tileValue = 'mb-[5px] mt-[13px] block font-display text-[26px] leading-none font-black uppercase';
  const tileNote = 'block font-term text-[12px] leading-[1.3] text-muted';

  return (
    <section className="mx-auto mt-9 w-full max-w-[680px] animate-rise phone:mt-[30px]" aria-label="Your result">
      {recoveryLeadsPage && recoveryVisible ? (
        <div className={`border-[3px] border-black shadow-hard ${TIER_STYLES[tier]}`}>
          {statusLine && <div className="px-5 pt-[18px] phone:px-[17px]">{statusLine}</div>}
          {recoveryBlock}
          <div className="flex items-center gap-3 px-5 py-2.5 phone:px-[17px]">
            <span className="h-px flex-1 bg-black/20" aria-hidden="true" />
            <span className="font-term text-[12px] font-black">then, for the rest of the semester</span>
            <span className="h-px flex-1 bg-black/20" aria-hidden="true" />
          </div>
          <div className="relative overflow-hidden px-5 pt-[22px] pb-[22px] [animation:var(--animate-flash)] phone:px-[17px] phone:pt-5 phone:pb-5">
            {heroContent}
          </div>
        </div>
      ) : (
        <div className={`relative overflow-hidden border-[3px] border-black px-5 pt-[22px] pb-[22px] shadow-hard [animation:var(--animate-flash)] phone:px-[17px] phone:pt-5 phone:pb-5 ${TIER_STYLES[tier]}`}>
          {statusLine}
          {heroContent}
        </div>
      )}
      {/* Four stats as a 2x2. Deliberately NOT using the `phone:` variant here:
          it is a min-width (>=650px) breakpoint, so a `phone:grid-cols-1`
          would stack these into a four-tall column on desktop while leaving
          real phones two-up. 2x2 reads correctly at both sizes. */}
      <div className="grid grid-cols-2 border-[3px] border-t-0 border-black bg-paper">
        <article className="min-h-[120px] border-r-2 border-b-2 border-black p-[17px]">
          <span className={tileTitle}>Days you can miss</span>
          <strong className={tileValue}><CountUp value={result.maximumFullDaysAbsent} /></strong>
          <small className={tileNote}>full college days off</small>
        </article>
        <article className="min-h-[120px] border-b-2 border-black p-[17px]">
          <span className={tileTitle}>Bunks per week</span>
          <strong className={tileValue}><CountUp value={perWeek(result.periodsPerWeek)} /></strong>
          <small className={tileNote}>periods a week, spread over {result.teachingWeeks} regular week{result.teachingWeeks === 1 ? '' : 's'}</small>
        </article>
        <article className="min-h-[120px] border-r-2 border-black p-[17px]">
          <span className={tileTitle}>Held so far</span>
          <strong className={tileValue}><CountUp value={result.heldSoFar} /></strong>
          <small className={tileNote}>{todayCounted > 0 ? `through yesterday, plus ${todayCounted} from today` : 'through yesterday'}</small>
        </article>
        <article className="min-h-[120px] p-[17px]">
          <span className={tileTitle}>Periods left</span>
          <strong className={tileValue}><CountUp value={result.remainingPeriods} /></strong>
          <small className={tileNote}>until the semester ends on {dateLabel(endDate)}</small>
        </article>
      </div>
      {!recoveryLeadsPage && recoveryVisible && <div className="mt-9 phone:mt-[30px]">{recoveryBlock}</div>}
    </section>
  );
}

function RecoveryCard({ recovery, label }: { recovery: RecoveryResult; label: string }) {
  return (
    <article className="border-2 border-black bg-paper p-3.5 text-black shadow-[2px_2px_0_var(--shadow-color)]">
      <span className="block font-display text-[14px] leading-[1.1] font-black uppercase text-black">{label}</span>
      {recovery.reachable && recovery.periodsRequired !== null ? (
        <>
          <strong className="mb-[5px] mt-[13px] block font-display text-[26px] leading-none font-black uppercase"><CountUp value={recovery.periodsRequired} /> classes in a row</strong>
          <small className="block font-term text-[12px] leading-[1.3] text-muted">
            {recovery.completesOn ? `Don't bunk anything until ${dateLabel(recovery.completesOn)}` : `about ${recovery.minimumCollegeDays} college days`}
          </small>
        </>
      ) : (
        <>
          <strong className="mb-[5px] mt-[13px] block font-display text-[26px] leading-none font-black uppercase">Not reachable</strong>
          <small className="block font-term text-[12px] leading-[1.3] text-muted">even attending every class, you&apos;d finish at {percentage(recovery.bestAchievablePercentage)}</small>
        </>
      )}
    </article>
  );
}
