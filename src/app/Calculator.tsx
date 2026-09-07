'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceResult } from '@/domain/attendance/types';
import { buildCalendar, currentIstDate } from '@/domain/schedule/calendar';
import type { ScheduleConfig } from '@/domain/schedule/types';
import { MonthCalendar } from './MonthCalendar';
import { SectionSelector, type SectionOption } from './SectionSelector';
import { SiteHeader } from './SiteHeader';

const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const percentage = (value: number) => `${value.toFixed(2)}%`;

// Device-local memory of the last-picked section, so a returning visitor
// lands straight on their inputs instead of re-picking every time. This is
// separate from (and doesn't undo) the deliberate choice elsewhere to ignore
// a shareable ?section= URL param on load.
const SECTION_STORAGE_KEY = 'dontbunk:lastSectionId';

function readStoredSectionId(): string | null {
  try {
    return window.localStorage.getItem(SECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSectionId(sectionId: string) {
  try {
    window.localStorage.setItem(SECTION_STORAGE_KEY, sectionId);
  } catch {
    // Ignore — e.g. private browsing with storage disabled.
  }
}

// localStorage never changes from outside this tab, so there's nothing to
// subscribe to — this just lets useSyncExternalStore read it safely without
// a server/client hydration mismatch (server snapshot is always '').
function subscribeToNothing() {
  return () => {};
}
function getStoredSectionSnapshot(): string {
  return readStoredSectionId() ?? '';
}
function getServerSectionSnapshot(): string {
  return '';
}

/** Human-friendly "held through yesterday" caption for the Current attendance input. */
function heldThroughYesterdayLabel(config: ScheduleConfig, now: Date): string {
  const today = currentIstDate(now);
  const calendar = buildCalendar(config, now);
  const count = calendar.heldThroughYesterday.length;
  if (today < config.semesterStart) {
    const startsLabel = formatter.format(new Date(`${config.semesterStart}T00:00:00`));
    return `Semester starts ${startsLabel} · 0 periods so far`;
  }
  if (calendar.future.length === 0 && count === 0) {
    return 'Semester ended · 0 periods so far';
  }
  // Yesterday in IST, not the user's wall clock — matches the engine. The
  // subtraction uses UTC arithmetic on the IST calendar date (safe: it's a
  // plain date, no time-of-day or DST involved), then the result is
  // re-parsed as a local midnight before formatting — the same pattern the
  // other labels in this file use — so the displayed date is always the
  // correct IST day regardless of the viewer's own timezone.
  const yesterdayUtc = new Date(`${today}T00:00:00Z`);
  yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
  const yesterdayIso = yesterdayUtc.toISOString().slice(0, 10);
  const throughLabel = formatter.format(new Date(`${yesterdayIso}T00:00:00`));
  return `${count} period${count === 1 ? '' : 's'} held through ${throughLabel}`;
}

type CalculatorProps = {
  sections: SectionOption[];
  /** Map of section id -> that section's loaded ScheduleConfig. */
  configsBySection: Record<string, ScheduleConfig>;
  /** Display name for each section id. */
  namesBySection: Record<string, string>;
};

export function Calculator({ sections, configsBySection, namesBySection }: CalculatorProps) {
  // The active section lives here, not in the parent, so the card stays
  // mounted when the user switches chips. That means the rise-in animation
  // only plays once (on first load), and there is no remount flash.
  // `explicitSectionId` is null until the user (or a restored preference)
  // has actually chosen something; `activeId` falls back to the stored
  // last-picked section (via useSyncExternalStore, which is hydration-safe:
  // the server snapshot is always '', so the first client render matches
  // the server before the real localStorage value is synced in).
  const [explicitSectionId, setExplicitSectionId] = useState<string | null>(null);
  const storedSectionId = useSyncExternalStore(subscribeToNothing, getStoredSectionSnapshot, getServerSectionSnapshot);
  const activeId = explicitSectionId ?? (sections.some((section) => section.id === storedSectionId) ? storedSectionId : '');
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('75');
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  // Bumped only inside calculate() so the Results panel remounts (and
  // its flash replays) exclusively on a fresh button press, never on
  // an input change.
  const [resultSeq, setResultSeq] = useState(0);
  // Track the section we calculated for so the Result renders with the
  // right `config.semesterEnd` even after a switch. We don't try to
  // reconcile the previous numbers — switching clears them.
  const [resultFor, setResultFor] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState(false);
  const calculationTimer = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Scroll the result into view on every fresh calculation (resultSeq only
  // bumps inside calculate(), never on mount), so a student who taps the
  // button on a short viewport isn't left staring at an unchanged screen.
  useEffect(() => {
    if (resultSeq === 0) return;
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [resultSeq]);

  // Section switch: drop the per-section inputs and any result so the user
  // never sees stale numbers from a different timetable.
  const firstRender = useRef(true);
  useEffect(() => {
    if (calculationTimer.current !== null) {
      window.clearTimeout(calculationTimer.current);
      calculationTimer.current = null;
    }
    if (firstRender.current) { firstRender.current = false; return; }
    setCurrent('');
    setError('');
    setResult(null);
    setResultFor('');
    setShowCalendar(false);
  }, [activeId]);

  useEffect(() => () => {
    if (calculationTimer.current !== null) window.clearTimeout(calculationTimer.current);
  }, []);

  // Logo click: send the user back to the blank picker. We prevent the
  // Link's default navigation and clear state in place — no full page
  // reload, no remount flash, no leftover ?section= in the URL.
  function handleHomeClick() {
    setExplicitSectionId('');
    setCalculating(false);
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return true;
  }

  function handleSectionSelect(sectionId: string) {
    setCalculating(false);
    setExplicitSectionId(sectionId);
    if (sectionId) storeSectionId(sectionId);
  }

  const active = sections.find((section) => section.id === activeId);
  const config = active ? configsBySection[active.id] : undefined;
  const sectionName = active ? (namesBySection[active.id] ?? active.name) : null;
  // Use the section the result was computed for, so the footer date stays
  // correct after a section switch.
  const resultSection = sections.find((section) => section.id === resultFor);
  const resultEndDate = resultSection ? configsBySection[resultSection.id]?.semesterEnd : undefined;
  // Memoized on `config` alone — the helper is pure and cheap enough that
  // we don't need to track `now` in React state. The day bucket will only
  // change in practice when the user re-opens the page or switches sections.
  const heldCaption = useMemo(
    () => (config ? heldThroughYesterdayLabel(config, new Date()) : ''),
    [config],
  );

  function calculate() {
    if (calculating) return;
    if (!activeId || !config) return;
    if (current.trim() === '') {
      setError('Enter your attendance to find out.');
      return;
    }
    if (target.trim() === '') {
      setError('Enter a target attendance between 0 and 100.');
      return;
    }
    const currentValue = Number(current);
    const targetValue = Number(target);
    if (!Number.isFinite(currentValue) || currentValue < 0 || currentValue > 100) {
      setError('Enter a current attendance between 0 and 100.');
      return;
    }
    if (!Number.isFinite(targetValue) || targetValue < 0 || targetValue > 100) {
      setError('Enter a target attendance between 0 and 100.');
      return;
    }
    setError('');
    setCalculating(true);
    // Brief spinner so the result reveal feels intentional.
    const requestedSectionId = activeId;
    calculationTimer.current = window.setTimeout(() => {
      calculationTimer.current = null;
      if (requestedSectionId !== activeId) return;
      setResult(calculateAttendance({ config, now: new Date(), currentPercentage: currentValue, targetPercentage: targetValue }));
      setResultFor(activeId);
      setResultSeq((n) => n + 1);
      setCalculating(false);
    }, 250);
  }

  return (
    <>
      <SiteHeader onHomeClick={handleHomeClick} />
      <main className="mx-auto w-full max-w-[680px] min-h-[calc(100vh-47px)] px-5 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))] phone:px-3 phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[680px] border-[3px] border-black bg-paper px-[clamp(16px,2vw,24px)] pt-[clamp(17px,2vw,24px)] pb-[clamp(18px,2.2vw,26px)] shadow-hard animate-rise" aria-label="Attendance calculator">
          <div className="mb-[clamp(16px,2vw,22px)]">
            <p className="eyebrow-text mb-[3px] text-[10px] text-black">{sectionName ? `${sectionName} / attendance desk` : 'attendance desk'}</p>
            <h1 className="m-0 font-display text-[clamp(27px,4.4vw,40px)] leading-[.95] font-black tracking-[.2px] uppercase">Can I bunk?</h1>
          </div>

          <SectionSelector sections={sections} selectedSectionId={activeId} onSelect={handleSectionSelect} />

          {active ? (
            <form onSubmit={(event) => { event.preventDefault(); calculate(); }}>
              <div className="mb-[clamp(17px,2vw,22px)] grid gap-[clamp(16px,1.8vw,20px)]">
                <label className="relative grid gap-[clamp(7px,.8vw,10px)] text-[12px] leading-[1.1] font-black text-black">
                  Current attendance %
                  <input className={`input-placeholder relative z-[1] min-h-[clamp(60px,8vw,80px)] w-full border-[3px] border-black bg-surface px-[clamp(13px,1.6vw,18px)] py-2 pr-[clamp(38px,5vw,52px)] font-sans text-[clamp(30px,4vw,40px)] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2 ${error ? 'input-error' : ''}`} inputMode="decimal" value={current} placeholder="Enter your attendance..." onChange={(event) => { setCurrent(event.target.value); if (error) setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); calculate(); } }} aria-invalid={error ? true : undefined} aria-label="Current attendance percentage" />
<span className="absolute right-[clamp(12px,1.6vw,18px)] bottom-[clamp(13px,2.4vw,24px)] z-[2] font-term text-[clamp(20px,2.6vw,26px)] leading-none font-black text-grey">%</span>
                  {heldCaption ? <span className="font-term text-[10px] leading-[1.3] font-normal text-muted">{heldCaption}</span> : null}
                </label>
                <label className="relative grid gap-[clamp(7px,.8vw,10px)] text-[12px] leading-[1.1] font-black text-black">
                  Target attendance %
                  <input className={`relative z-[1] min-h-[clamp(60px,8vw,80px)] w-full border-[3px] border-black bg-surface px-[clamp(13px,1.6vw,18px)] py-2 pr-[clamp(38px,5vw,52px)] font-sans text-[clamp(30px,4vw,40px)] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2 ${error ? 'input-error' : ''}`} inputMode="decimal" value={target} onChange={(event) => { setTarget(event.target.value); if (error) setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); calculate(); } }} aria-invalid={error ? true : undefined} aria-label="Target attendance percentage" />
                  <span className="absolute right-[clamp(12px,1.6vw,18px)] bottom-[clamp(13px,2.4vw,24px)] z-[2] font-term text-[clamp(20px,2.6vw,26px)] leading-none font-black text-grey">%</span>
                </label>
              </div>
              {error && <p className="mb-[13px] border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{error}</p>}

              <button className="btn-calculate btn-calculate-hover" type="submit" disabled={calculating} aria-busy={calculating}>
                {calculating ? 'Calculating…' : <>Can I bunk? <span aria-hidden="true">↗</span></>}
              </button>
            </form>
          ) : (
            <p className="mt-[6px] font-term text-[12px] leading-[1.4] text-muted">Pick your section above to load its timetable.</p>
          )}
        </section>

        {result && resultEndDate ? <div ref={resultsRef}><Results key={resultSeq} result={result} endDate={resultEndDate} heldLabel={heldCaption} /></div> : null}

        {active && config ? (
          <div className="mx-auto mt-9 w-full max-w-[680px] phone:mt-[30px]">
            <button type="button" onClick={() => setShowCalendar((value) => !value)} className="flex w-full cursor-pointer items-center justify-between border-[3px] border-black bg-paper px-5 py-[18px] shadow-hard phone:px-[17px]" aria-expanded={showCalendar}>
              <span className="font-term text-[11px] font-black uppercase tracking-[.55px] text-black">{showCalendar ? 'Hide' : 'View'} semester calendar</span>
              <span aria-hidden="true" className="font-display text-[20px] leading-none font-black">{showCalendar ? '−' : '+'}</span>
            </button>
            {showCalendar && <div className="mt-3"><MonthCalendar config={config} /></div>}
          </div>
        ) : null}

<a className="show-desktop mx-auto mt-[clamp(10px,1.6vw,16px)] min-h-11 w-full max-w-[680px] items-center justify-center py-[3px] text-center font-term text-[9px] font-black uppercase tracking-[.55px] text-muted underline decoration-link decoration-dotted decoration-[3px] underline-offset-[3px] hover:text-black" href="/admin">Admin panel</a>
      </main>
    </>
  );
}

const DANGER_ATTENDANCE_RATIO = 0.9;
const CAUTION_ATTENDANCE_RATIO = 0.5;

type ResultTier = 'lime' | 'yellow' | 'orange' | 'red';

// Result hero severity: lime (safe) -> yellow (recoverable, or zero bunks
// left but still on track) -> orange (recovery is tight) -> red (unreachable
// or recovery needs 90%+ of everything left). This is deliberately keyed
// ONLY on the fixed 75% recovery figure (recoveryTo75), never on a custom
// target — a student who has already cleared 75% but is behind a stricter
// personal goal still gets lime/yellow here, even though the Recovery mode
// section below may still show a card for their own target.
const TIER_STYLES: Record<ResultTier, string> = {
  lime: 'bg-lime text-[#14261c]',
  yellow: 'bg-hero-yellow text-hero-yellow-ink',
  orange: 'bg-hero-orange text-hero-orange-ink',
  red: 'bg-hero-danger text-hero-danger-ink',
};

function resultTier(result: AttendanceResult, needsRecoveryTo75: boolean): ResultTier {
  if (!needsRecoveryTo75) return result.maximumBunks === 0 ? 'yellow' : 'lime';
  const { recoveryTo75 } = result;
  if (recoveryTo75.reachable === false || recoveryTo75.periodsRequired === null || result.remainingPeriods === 0) return 'red';
  const ratio = recoveryTo75.periodsRequired / result.remainingPeriods;
  if (ratio > DANGER_ATTENDANCE_RATIO) return 'red';
  if (ratio >= CAUTION_ATTENDANCE_RATIO) return 'orange';
  return 'yellow';
}

function Results({ result, endDate, heldLabel }: { result: AttendanceResult; endDate: string; heldLabel: string }) {
  const { recoveryTo75 } = result;
  const unreachable = recoveryTo75.reachable === false;
  // Whether Recovery mode is SHOWN AT ALL considers both the fixed 75% floor
  // and a custom target — a student clear of 75% but behind a stricter
  // personal goal still sees this section (with only the "To reach {target}%"
  // card, since the 75% one already reads 0). But whether it LEADS the page
  // (above the hero) and the hero's color tier both consider only the fixed
  // 75% figure — a custom-target-only shortfall doesn't get the urgent
  // treatment, it just sits in its normal spot below the hero.
  const recoveryVisible = (result.recoveryTo75.periodsRequired ?? 0) > 0 || (result.recoveryToTarget.periodsRequired ?? 0) > 0;
  const recoveryLeadsPage = (result.recoveryTo75.periodsRequired ?? 0) > 0;
  const tier = resultTier(result, recoveryLeadsPage);
  const isDanger = tier === 'red';
  // Styled like the hero (same border/shadow/padding language). When it
  // leads the page it also shares the hero's tier color, so the two boxes
  // read as one urgent unit; when it only trails (custom-target-only case)
  // it stays a neutral paper box, since that case isn't meant to alarm.
  const recoveryBlock = recoveryVisible && (
    <div className={`grid grid-cols-1 gap-[18px] border-[3px] border-black px-5 pt-[22px] pb-[22px] shadow-hard phone:px-[17px] phone:pt-5 phone:pb-5 ${recoveryLeadsPage ? TIER_STYLES[tier] : 'bg-paper text-black'}`}>
      <p className={`font-term text-[11px] leading-[1.4] ${recoveryLeadsPage ? 'font-bold' : 'text-muted'}`}><span className="eyebrow-text">Recovery mode</span> | Assumes zero bunks from today.</p>
      {recoveryLeadsPage ? (
        <div>
          <div className="font-display text-[88px] leading-[.8] font-black tracking-[-2px] phone:text-[clamp(74px,24vw,100px)]">{result.recoveryTo75.periodsRequired}</div>
          <h3 className="mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">periods to reach 75%</h3>
          <p className="m-0 font-term text-[13px] leading-[1.4] font-bold">over the next <strong>{result.recoveryTo75.minimumCollegeDays} college days</strong></p>
        </div>
      ) : (
        <RecoveryCard recovery={result.recoveryTo75} label="To reach 75%" />
      )}
      {result.targetPercentage !== 75 && (
        <RecoveryCard recovery={result.recoveryToTarget} label={`To reach ${percentage(result.targetPercentage)}`} />
      )}
    </div>
  );
  return (
    <section className="mx-auto mt-9 w-full max-w-[680px] animate-rise phone:mt-[30px]" aria-live="polite">
      {recoveryLeadsPage && (
        <div className="mb-9 phone:mb-[30px]">
          {recoveryBlock}
          <p className="mt-3 text-center font-term text-[10px] font-black uppercase tracking-[.55px] text-muted">↓ then, for the rest of the semester</p>
        </div>
      )}
      <div className={`relative overflow-hidden border-[3px] border-black px-5 pt-[22px] pb-[22px] shadow-hard [animation:var(--animate-flash)] phone:px-[17px] phone:pt-5 phone:pb-5 ${TIER_STYLES[tier]}`}>
        <p className={`eyebrow-text mb-3 text-[10px] ${isDanger ? 'text-hero-danger-ink' : 'text-black'}`}>Your semester runway</p>
        <div className="relative z-[1] font-display text-[88px] leading-[.8] font-black tracking-[-2px] phone:text-[clamp(74px,24vw,100px)]">{result.maximumBunks}</div>
        {isDanger ? (
          <>
            <h2 className="relative z-[1] mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">{unreachable ? 'recovery is out of reach' : "you're in deep trouble"}</h2>
            <p className="relative z-[1] m-0 font-term text-[13px] leading-[1.4] font-bold">even attending everything leaves you at <strong>{percentage(recoveryTo75.bestAchievablePercentage)}</strong> vs the 75% bar</p>
          </>
        ) : (
          <>
            <h2 className="relative z-[1] mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">periods you can bunk this sem</h2>
            <p className="relative z-[1] m-0 font-term text-[13px] leading-[1.4] font-bold">and still land at <strong>{percentage(result.finalPercentageAtMaximumBunks)}</strong></p>
          </>
        )}
        <span className="absolute right-[7%] bottom-[-70px] size-[180px] rounded-full border-[30px] border-white/25" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-2 border-[3px] border-t-0 border-black bg-paper phone:grid-cols-1">
        <article className="min-h-[120px] border-r-2 border-black p-[17px] phone:min-h-0 phone:border-r-0 phone:border-b-2">
          <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">Held so far</span>
          <strong className="mb-[5px] mt-[13px] block font-display text-[23px] leading-none font-black">{result.heldPeriods}</strong>
          <small className="block font-term text-[10px] leading-[1.3] text-muted">{heldLabel.replace(/^\d+ periods? held through /, 'through ')}</small>
        </article>
        <article className="min-h-[120px] p-[17px] phone:min-h-0">
          <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">Periods left</span>
          <strong className="mb-[5px] mt-[13px] block font-display text-[23px] leading-none font-black">{result.remainingPeriods}</strong>
          <small className="block font-term text-[10px] leading-[1.3] text-muted">until semester end</small>
        </article>
      </div>
      {!recoveryLeadsPage && recoveryVisible && <div className="mt-9 phone:mt-[30px]">{recoveryBlock}</div>}
      <p className="mt-5 font-term text-[10px] leading-[1.5] uppercase tracking-[.55px] text-muted">Planning through <strong>{formatter.format(new Date(`${endDate}T00:00:00`))}</strong>. Today is excluded until reliable attendance is available.</p>
    </section>
  );
}

function RecoveryCard({ recovery, label }: { recovery: AttendanceResult['recoveryTo75']; label: string }) {
  return (
    <article className="border-2 border-black bg-paper p-3.5 shadow-[2px_2px_0_var(--shadow-color)]">
      <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">{label}</span>
      {recovery.reachable && recovery.periodsRequired !== null ? <><strong className="mb-[5px] mt-[13px] block font-display text-[19px] leading-none font-black">{recovery.periodsRequired} periods</strong><small className="block font-term text-[10px] leading-[1.3] text-muted">/ {recovery.minimumCollegeDays} college days</small></> : <><strong className="mb-[5px] mt-[13px] block font-display text-[19px] leading-none font-black">Not reachable</strong><small className="block font-term text-[10px] leading-[1.3] text-muted">best finish: {percentage(recovery.bestAchievablePercentage)}</small></>}
    </article>
  );
}
