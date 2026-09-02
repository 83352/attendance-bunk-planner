'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceResult } from '@/domain/attendance/types';
import type { ScheduleConfig } from '@/domain/schedule/types';
import { SectionSelector, type SectionOption } from './SectionSelector';
import { SiteHeader } from './SiteHeader';

const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const percentage = (value: number) => `${value.toFixed(2)}%`;

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
  const [activeId, setActiveId] = useState('');
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
  const calculationTimer = useRef<number | null>(null);

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
  }, [activeId]);

  useEffect(() => () => {
    if (calculationTimer.current !== null) window.clearTimeout(calculationTimer.current);
  }, []);

  // Logo click: send the user back to the blank picker. We prevent the
  // Link's default navigation and clear state in place — no full page
  // reload, no remount flash, no leftover ?section= in the URL.
  function handleHomeClick() {
    setActiveId('');
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return true;
  }

  const active = sections.find((section) => section.id === activeId);
  const config = active ? configsBySection[active.id] : undefined;
  const sectionName = active ? (namesBySection[active.id] ?? active.name) : null;
  // Use the section the result was computed for, so the footer date stays
  // correct after a section switch.
  const resultSection = sections.find((section) => section.id === resultFor);
  const resultEndDate = resultSection ? configsBySection[resultSection.id]?.semesterEnd : undefined;

  function calculate() {
    if (calculating) return;
    if (!activeId || !config) return;
    if (current.trim() === '') {
      setError('Enter your attendance to find out.');
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

          <SectionSelector sections={sections} selectedSectionId={activeId} onSelect={setActiveId} />

          {active ? (
            <>
              <div className="mb-[clamp(17px,2vw,22px)] grid gap-[clamp(16px,1.8vw,20px)]">
                <label className="relative grid gap-[clamp(7px,.8vw,10px)] text-[12px] leading-[1.1] font-black text-black">
                  Current attendance %
                  <input className={`input-placeholder relative z-[1] min-h-[clamp(60px,8vw,80px)] w-full border-[3px] border-black bg-surface px-[clamp(13px,1.6vw,18px)] py-2 pr-[clamp(38px,5vw,52px)] font-sans text-[clamp(30px,4vw,40px)] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2 ${error ? 'input-error' : ''}`} inputMode="decimal" value={current} placeholder="Enter your attendance..." onChange={(event) => { setCurrent(event.target.value); if (error) setError(''); }} aria-invalid={error ? true : undefined} aria-label="Current attendance percentage" />
<span className="absolute right-[clamp(12px,1.6vw,18px)] bottom-[clamp(13px,2.4vw,24px)] z-[2] font-term text-[clamp(16px,2vw,20px)] leading-none font-bold text-grey">%</span>
                </label>
                <label className="relative grid gap-[clamp(7px,.8vw,10px)] text-[12px] leading-[1.1] font-black text-black">
                  Target attendance %
                  <input className={`relative z-[1] min-h-[clamp(60px,8vw,80px)] w-full border-[3px] border-black bg-surface px-[clamp(13px,1.6vw,18px)] py-2 pr-[clamp(38px,5vw,52px)] font-sans text-[clamp(30px,4vw,40px)] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2 ${error ? 'input-error' : ''}`} inputMode="decimal" value={target} onChange={(event) => { setTarget(event.target.value); if (error) setError(''); }} aria-invalid={error ? true : undefined} aria-label="Target attendance percentage" />
                  <span className="absolute right-[clamp(12px,1.6vw,18px)] bottom-[clamp(13px,2.4vw,24px)] z-[2] font-term text-[clamp(16px,2vw,20px)] leading-none font-bold text-grey">%</span>
                </label>
              </div>
              {error && <p className="mb-[13px] border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{error}</p>}

              <button className="btn-calculate btn-calculate-hover" type="button" onClick={calculate} disabled={calculating} aria-busy={calculating}>
                {calculating ? 'Calculating…' : <>Can I bunk? <span aria-hidden="true">↗</span></>}
              </button>
            </>
          ) : (
            <p className="mt-[6px] font-term text-[12px] leading-[1.4] text-muted">Pick your section above to load its timetable.</p>
          )}
        </section>

        {result && resultEndDate ? <Results key={resultSeq} result={result} endDate={resultEndDate} /> : null}

<a className="show-desktop mx-auto mt-[clamp(10px,1.6vw,16px)] min-h-11 w-full max-w-[680px] items-center justify-center py-[3px] text-center font-term text-[9px] font-black uppercase tracking-[.55px] text-muted underline decoration-link decoration-dotted decoration-[3px] underline-offset-[3px] hover:text-black" href="/admin">Owner? Admin panel</a>
      </main>
    </>
  );
}

const DANGER_ATTENDANCE_RATIO = 0.9;

function Results({ result, endDate }: { result: AttendanceResult; endDate: string }) {
  const { recoveryTo75 } = result;
  const unreachable = recoveryTo75.reachable === false;
  const brutal = recoveryTo75.reachable
    && recoveryTo75.periodsRequired !== null
    && result.remainingPeriods > 0
    && recoveryTo75.periodsRequired / result.remainingPeriods > DANGER_ATTENDANCE_RATIO;
  const isDanger = unreachable || brutal;
  return (
    <section className="mx-auto mt-9 w-full max-w-[680px] animate-rise phone:mt-[30px]" aria-live="polite">
      <div className={`relative overflow-hidden border-[3px] border-black px-5 pt-[22px] pb-[22px] shadow-hard [animation:var(--animate-flash)] phone:px-[17px] phone:pt-5 phone:pb-5 ${isDanger ? 'bg-hero-danger text-hero-danger-ink' : 'bg-lime text-[#14261c]'}`}>
        <p className={`eyebrow-text mb-3 text-[10px] ${isDanger ? 'text-hero-danger-ink' : 'text-black'}`}>Your semester runway</p>
        <div className="relative z-[1] font-display text-[88px] leading-[.8] font-black tracking-[-2px] phone:text-[clamp(74px,24vw,100px)]">{result.maximumBunks}</div>
        {isDanger ? (
          <>
            <h2 className="mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">{unreachable ? 'recovery is out of reach' : "you're in deep trouble"}</h2>
            <p className="m-0 font-term text-[13px] leading-[1.4] font-bold">even attending everything leaves you at <strong>{percentage(recoveryTo75.bestAchievablePercentage)}</strong> vs the 75% bar</p>
          </>
        ) : (
          <>
            <h2 className="mt-[14px] mb-[5px] font-display text-[25px] leading-none font-black uppercase">periods you can bunk</h2>
            <p className="m-0 font-term text-[13px] leading-[1.4] font-bold">and still finish at <strong>{percentage(result.targetPercentage)}</strong></p>
          </>
        )}
        <span className="absolute right-[7%] bottom-[-70px] size-[180px] rounded-full border-[30px] border-white/25" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-3 border-[3px] border-t-0 border-black bg-paper phone:grid-cols-1">
        <article className="min-h-[120px] border-r-2 border-black p-[17px] phone:min-h-0 phone:border-r-0 phone:border-b-2">
          <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">Mathematical pace</span>
          <strong className="mb-[5px] mt-[13px] block font-display text-[23px] leading-none font-black">{result.periodsPerWeek.toFixed(2)} <small className="font-term text-[10px] leading-[1.3] font-normal text-muted">periods / week</small></strong>
        </article>
        <article className="min-h-[120px] border-r-2 border-black p-[17px] phone:min-h-0 phone:border-r-0 phone:border-b-2">
          <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">Future periods</span>
          <strong className="mb-[5px] mt-[13px] block font-display text-[23px] leading-none font-black">{result.remainingPeriods}</strong>
          <small className="block font-term text-[10px] leading-[1.3] text-muted">until semester end</small>
        </article>
        <article className="min-h-[120px] p-[17px] phone:min-h-0">
          <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">At the finish line</span>
          <strong className="mb-[5px] mt-[13px] block font-display text-[23px] leading-none font-black">{percentage(result.finalPercentageAtMaximumBunks)}</strong>
          <small className="block font-term text-[10px] leading-[1.3] text-muted">with every safe bunk used</small>
        </article>
      </div>
      <div className="grid grid-cols-1 gap-[18px] border-b-[3px] border-dotted border-red py-6">
        <div><p className="eyebrow-text mb-3 text-[10px]">A practical rhythm</p><h3 className="m-0 max-w-[320px] font-display text-[22px] leading-[1.05] font-black uppercase">Spread the bunks, keep your options open.</h3></div>
        <div className="flex flex-wrap content-center gap-2">{result.practicalBunksByWeek.map((bunks, index) => <div className="grid min-w-[48px] border-2 border-black bg-surface p-[9px_7px] text-center shadow-[2px_2px_0_var(--shadow-color)] phone:min-h-[52px] phone:min-w-[52px]" key={`${index}-${bunks}`}><span className="font-term text-[9px] text-muted">W{index + 1}</span><strong className="mt-1 font-display text-[21px] leading-none font-black">{bunks}</strong></div>)}</div>
      </div>
      {((result.recoveryTo75.periodsRequired ?? 0) > 0 || (result.recoveryToTarget.periodsRequired ?? 0) > 0) && (
        <div className="grid grid-cols-1 gap-[18px] border-b-[3px] border-dotted border-red py-6">
          <div><p className="eyebrow-text mb-3 text-[10px]">Recovery mode</p><h3 className="m-0 max-w-[320px] font-display text-[22px] leading-[1.05] font-black uppercase">Build your attendance back, one day at a time.</h3></div>
          <RecoveryCard recovery={result.recoveryTo75} label="To reach 75%" />
          {result.targetPercentage !== 75 && (
            <RecoveryCard recovery={result.recoveryToTarget} label={`To reach ${percentage(result.targetPercentage)}`} />
          )}
        </div>
      )}
      <p className="mt-5 font-term text-[10px] leading-[1.5] uppercase tracking-[.55px] text-muted">Planning through <strong>{formatter.format(new Date(`${endDate}T00:00:00`))}</strong>. Today is excluded until reliable attendance is available.</p>
    </section>
  );
}

function RecoveryCard({ recovery, label }: { recovery: AttendanceResult['recoveryTo75']; label: string }) {
  return (
    <article className="border-2 border-black bg-paper p-3.5 shadow-[2px_2px_0_var(--shadow-color)]">
      <span className="block font-term text-[10px] leading-[1.3] uppercase tracking-[.55px] text-muted">{label}</span>
      {recovery.reachable && recovery.periodsRequired !== null ? <><strong className="mb-[5px] mt-[13px] block font-display text-[19px] leading-none font-black">{recovery.periodsRequired} periods</strong><small className="block font-term text-[10px] leading-[1.3] text-muted">minimum {recovery.minimumCollegeDays} college days</small></> : <><strong className="mb-[5px] mt-[13px] block font-display text-[19px] leading-none font-black">Not reachable</strong><small className="block font-term text-[10px] leading-[1.3] text-muted">best finish: {percentage(recovery.bestAchievablePercentage)}</small></>}
    </article>
  );
}
