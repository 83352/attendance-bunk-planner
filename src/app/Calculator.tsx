'use client';

import { useState } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceResult } from '@/domain/attendance/types';
import type { ScheduleConfig } from '@/domain/schedule/types';
import Link from 'next/link';
import { SectionSelector, type SectionOption } from './SectionSelector';

const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const percentage = (value: number) => `${value.toFixed(2)}%`;

type CalculatorProps = {
  config: ScheduleConfig;
  sectionName: string;
  sections: SectionOption[];
  selectedSectionId: string;
  onSelectSection?: (sectionId: string) => void;
};

export function Calculator({ config, sectionName, sections, selectedSectionId, onSelectSection }: CalculatorProps) {
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('75');
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [error, setError] = useState('');

  function calculate() {
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
    setResult(calculateAttendance({ config, now: new Date(), currentPercentage: currentValue, targetPercentage: targetValue }));
  }

  return (
    <>
      <header className="relative flex min-h-[47px] items-center justify-center border-b-[3px] border-[#111111] bg-[#111111] px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-[10px] text-[#f5f2e9] phone:min-h-[52px] phone:justify-start phone:px-[18px]">
        <Link className="font-display text-[16px] leading-none font-black tracking-[0.75px] no-underline text-[#f5f2e9] phone:text-[17px]" href="/" aria-label="dontbunk home">
dont<span className="text-[#b7f14a]">bunk</span>
        </Link>
        <span className="absolute right-6 rotate-45 text-[14px] text-lime phone:right-5" aria-hidden="true">◆</span>
      </header>

      <main className="mx-auto w-full max-w-[680px] min-h-[calc(100vh-47px)] px-5 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))] phone:px-3 phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[294px] border-[3px] border-black bg-paper px-4 pt-[17px] pb-[18px] shadow-hard animate-rise phone:max-w-[420px] phone:pt-[18px] phone:pb-5" aria-label="Attendance calculator">
          <div className="mb-4 flex items-start gap-3 phone:mb-[19px] phone:gap-2.5">
            <span className="mt-px grid size-[27px] shrink-0 place-items-center border-2 border-black bg-orange font-term text-[11px] leading-none font-black text-white">01</span>
            <div>
              <p className="eyebrow-text mb-[3px] text-[10px] text-black">{sectionName} / attendance desk</p>
              <h1 className="m-0 font-display text-[28px] leading-[.95] font-black tracking-[.2px] uppercase phone:text-[clamp(27px,8vw,35px)]">Can I bunk?</h1>
            </div>
          </div>

          <SectionSelector sections={sections} selectedSectionId={selectedSectionId} onSelect={onSelectSection ?? (() => {})} />

          <div className="mb-[17px] grid gap-4 phone:mb-5 phone:gap-[18px]">
            <label className="relative grid gap-[7px] text-[10px] leading-[1.1] font-black text-black phone:gap-2">
              Current attendance %
              <input className="input-placeholder relative z-[1] min-h-[54px] w-full border-[3px] border-black bg-surface px-[13px] py-2 pr-[38px] font-sans text-[30px] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2 phone:min-h-[56px] phone:pl-3" inputMode="decimal" value={current} placeholder="Enter your attendance..." onChange={(event) => setCurrent(event.target.value)} aria-label="Current attendance percentage" />
              <span className="absolute right-3 bottom-[13px] z-[2] font-term text-[13px] leading-none font-bold text-grey phone:bottom-[15px]">%</span>
            </label>
            <label className="relative grid gap-[7px] text-[10px] leading-[1.1] font-black text-black phone:gap-2">
              Target attendance %
              <input className="relative z-[1] min-h-[54px] w-full border-[3px] border-black bg-surface px-[13px] py-2 pr-[38px] font-sans text-[30px] leading-[.95] font-black text-black shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2 phone:min-h-[56px] phone:pl-3" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Target attendance percentage" />
              <span className="absolute right-3 bottom-[13px] z-[2] font-term text-[13px] leading-none font-bold text-grey phone:bottom-[15px]">%</span>
            </label>
          </div>
          {error && <p className="mb-[13px] border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{error}</p>}

          <button className="btn-calculate btn-calculate-hover" type="button" onClick={calculate}>
            Can I bunk? <span aria-hidden="true">↗</span>
          </button>
        </section>

        {result ? <Results result={result} endDate={config.semesterEnd} /> : <p className="mx-auto mt-[18px] w-full max-w-[294px] text-center font-term text-[9px] leading-[1.45] text-muted phone:mt-5 phone:max-w-[420px] phone:px-2">Your timetable and semester calendar are already loaded.</p>}

        <a className="mx-auto mt-3 flex min-h-11 w-full max-w-[294px] items-center justify-center py-[3px] text-center font-term text-[9px] font-black uppercase tracking-[.55px] text-muted underline decoration-link decoration-dotted decoration-[3px] underline-offset-[3px] hover:text-black phone:mt-2.5 phone:max-w-[420px]" href="/admin">Owner? Admin panel</a>
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
      <div className={`relative overflow-hidden border-[3px] border-black px-5 pt-[22px] pb-[22px] shadow-hard phone:px-[17px] phone:pt-5 phone:pb-5 ${isDanger ? 'bg-hero-danger text-hero-danger-ink' : 'bg-lime text-[#14261c]'}`}>
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
