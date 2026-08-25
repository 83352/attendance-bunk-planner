'use client';

import { useMemo, useState } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceResult } from '@/domain/attendance/types';
import type { ScheduleConfig } from '@/domain/schedule/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const percentage = (value: number) => `${value.toFixed(2)}%`;

function parsePercentage(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

type SectionOption = { id: string; name: string };

type CalculatorProps = {
  config: ScheduleConfig;
  sectionName: string;
  sections: SectionOption[];
  selectedSectionId: string;
};

export function Calculator({ config, sectionName, sections, selectedSectionId }: CalculatorProps) {
  const router = useRouter();
  const [current, setCurrent] = useState('78');
  const [target, setTarget] = useState('75');

  // Recalculate on every keystroke. Invalid input keeps the last good result
  // on screen and surfaces an inline hint instead of wiping the answer.
  const { result, error } = useMemo(() => {
    const currentPercentage = parsePercentage(current);
    if (currentPercentage === null) return { result: null, error: current.trim() === '' ? '' : 'Enter a current attendance between 0 and 100.' };
    const targetPercentage = parsePercentage(target);
    if (targetPercentage === null) return { result: null, error: target.trim() === '' ? '' : 'Enter a target attendance between 0 and 100.' };
    return { result: calculateAttendance({ config, now: new Date(), currentPercentage, targetPercentage }), error: '' };
  }, [config, current, target]);

  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Bunk Planner home">
          BUNK<span>{'//'}</span>PLANNER
        </Link>
        <span className="header-spark" aria-hidden="true">◆</span>
      </header>

      <main className="shell">
        <section className="calculator-panel" aria-label="Attendance calculator">
          <div className="form-heading">
            <span className="step">01</span>
            <div>
              <p className="panel-kicker">{sectionName} / attendance desk</p>
              <h1>Can I bunk?</h1>
            </div>
          </div>

          {sections.length > 1 && (
            <label className="public-section">
              Your section
              <select value={selectedSectionId} onChange={(event) => router.push(`/?section=${event.target.value}`)}>
                {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </label>
          )}

          <div className="inputs">
            <label>
              Current attendance %
              <input inputMode="decimal" value={current} onChange={(event) => setCurrent(event.target.value)} aria-label="Current attendance percentage" />
              <span>%</span>
            </label>
            <label>
              Target attendance %
              <input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Target attendance percentage" />
              <span>%</span>
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        {result ? <Results result={result} endDate={config.semesterEnd} /> : <p className="quiet-note">Your timetable and semester calendar are already loaded.</p>}

        <a className="admin-link" href="/admin">Owner? Admin panel</a>
      </main>
    </>
  );
}

function Results({ result, endDate }: { result: AttendanceResult; endDate: string }) {
  return (
    <section className="results" aria-live="polite">
      <div className="result-hero">
        <p className="eyebrow">Your semester runway</p>
        <div className="bunk-number">{result.maximumBunks}</div>
        <h2>periods you can bunk</h2>
        <p>and still finish at <strong>{percentage(result.targetPercentage)}</strong></p>
      </div>
      <div className="result-grid">
        <article><span>Mathematical pace</span><strong>{result.periodsPerWeek.toFixed(2)} <small>periods / week</small></strong></article>
        <article><span>Future periods</span><strong>{result.remainingPeriods}</strong><small>until semester end</small></article>
        <article><span>At the finish line</span><strong>{percentage(result.finalPercentageAtMaximumBunks)}</strong><small>with every safe bunk used</small></article>
      </div>
      <div className="distribution">
        <div><p className="eyebrow">A practical rhythm</p><h3>Spread the bunks, keep your options open.</h3></div>
        <div className="week-row">{result.practicalBunksByWeek.map((bunks, index) => <div className="week" key={`${index}-${bunks}`}><span>W{index + 1}</span><strong>{bunks}</strong></div>)}</div>
      </div>
      {((result.recoveryTo75.periodsRequired ?? 0) > 0 || (result.recoveryToTarget.periodsRequired ?? 0) > 0) && (
        <div className="recovery">
          <div><p className="eyebrow">Recovery mode</p><h3>Build your attendance back, one day at a time.</h3></div>
          <RecoveryCard recovery={result.recoveryTo75} label="To reach 75%" />
          <RecoveryCard recovery={result.recoveryToTarget} label={`To reach ${percentage(result.targetPercentage)}`} />
        </div>
      )}
      <p className="semester-note">Planning through <strong>{formatter.format(new Date(`${endDate}T00:00:00`))}</strong>. Today is excluded until reliable attendance is available.</p>
    </section>
  );
}

function RecoveryCard({ recovery, label }: { recovery: AttendanceResult['recoveryTo75']; label: string }) {
  return (
    <article className="recovery-card">
      <span>{label}</span>
      {recovery.reachable && recovery.periodsRequired !== null ? <><strong>{recovery.periodsRequired} periods</strong><small>minimum {recovery.minimumCollegeDays} college days</small></> : <><strong>Not reachable</strong><small>best finish: {percentage(recovery.bestAchievablePercentage)}</small></>}
    </article>
  );
}
