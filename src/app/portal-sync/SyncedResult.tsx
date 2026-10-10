'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceResult } from '@/domain/attendance/types';
import type { CalendarOverrides } from '@/lib/portal/calendar-overrides';
import type { PortalSyncResult, PortalTimetableSession } from '@/lib/portal/campx-client';
import { answerKey, parseAnswers, pruneAnswers, readRawAnswers, readRawTarget, saveAnswer, saveTarget, subscribeSaved, type Answer } from '@/lib/portal/saved-answers';
import {
  buildCalculationInput,
  describeActivePatches,
  findUngradedPastSessions,
  hasUnscheduledExamGap,
  patchedTimetable,
  type PastOverrides,
} from '@/lib/portal/to-calculation-input';
import { MonthCalendar } from '../MonthCalendar';
import { RawDataDump } from './RawDataDump';
import { ResultCard } from './ResultCard';
import { UngradedList } from './UngradedList';

const TARGET_PRESETS = [75, 80, 85];

/** Everything that happens once we have real portal data: ask about ungraded past sessions, then compute and show the result. */
export function SyncedResult({ data, overrides }: { data: PortalSyncResult; overrides: CalendarOverrides | null }) {
  const now = useMemo(() => new Date(), []);
  const ungraded = useMemo(() => findUngradedPastSessions(data, now, overrides), [data, now, overrides]);
  const patched = useMemo(() => patchedTimetable(data, overrides, now), [data, overrides, now]);
  const patchNotes = useMemo(() => describeActivePatches(data, overrides, now), [data, overrides, now]);

  // Answers and the target live in localStorage (so they survive a reload) and
  // are read through useSyncExternalStore: the server snapshot is "nothing
  // saved", so this view can be server-rendered without a hydration mismatch.
  const rawAnswers = useSyncExternalStore(subscribeSaved, readRawAnswers, () => null);
  const rawTarget = useSyncExternalStore(subscribeSaved, readRawTarget, () => null);
  const answers = useMemo(() => pruneAnswers(parseAnswers(rawAnswers), ungraded.map(answerKey)), [rawAnswers, ungraded]);
  const target = rawTarget ?? '75';
  const [calculated, setCalculated] = useState(false);

  const answeredCount = ungraded.filter((session) => answers[answerKey(session)]).length;
  const allAnswered = answeredCount === ungraded.length;
  const targetNum = Number(target);
  const targetValid = target.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0 && targetNum <= 100;

  const result: AttendanceResult | null = useMemo(() => {
    if (!calculated || !targetValid || !allAnswered) return null;
    const pastOverrides: PastOverrides = { attended: 0, bunked: 0 };
    for (const session of ungraded) {
      if (answers[answerKey(session)] === 'attended') pastOverrides.attended += 1;
      else pastOverrides.bunked += 1;
    }
    return calculateAttendance(buildCalculationInput(data, targetNum, pastOverrides, now, overrides));
  }, [calculated, targetValid, allAnswered, answers, ungraded, data, targetNum, now, overrides]);

  const onAnswer = (session: PortalTimetableSession, answer: Answer) => {
    saveAnswer(answerKey(session), answer, ungraded.map(answerKey));
    setCalculated(false);
  };

  const changeTarget = (value: string) => {
    saveTarget(value);
    setCalculated(false);
  };

  const headsUp = [
    ...patchNotes,
    ...(!overrides ? ['There is no manual calendar for your year, so holidays and exams the portal has not published yet are not accounted for.'] : []),
    ...(hasUnscheduledExamGap(now, overrides) ? ['The next exam is not scheduled yet, so this number does not account for it.'] : []),
  ];

  return (
    <div className="grid gap-5">
      {ungraded.length > 0 && <UngradedList sessions={ungraded} answers={answers} onAnswer={onAnswer} />}

      <section className="card animate-rise grid gap-4 p-4 phone:p-5" style={{ animationDelay: '60ms' }}>
        <div>
          <label htmlFor="target" className="eyebrow-text mb-1.5 block text-[10px] text-teal">Target attendance</label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-28">
              <input
                id="target"
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                value={target}
                onChange={(event) => changeTarget(event.target.value)}
                className="field pr-8"
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center font-term text-[13px] text-muted">%</span>
            </div>
            {TARGET_PRESETS.map((preset) => (
              <button key={preset} type="button" aria-pressed={targetNum === preset} onClick={() => changeTarget(String(preset))} className={`chip ${targetNum === preset ? '!border-link !text-link' : ''}`}>
                {preset}%
              </button>
            ))}
          </div>
          {!targetValid && <p role="alert" className="m-0 mt-2 font-term text-[11px] font-bold text-error">Enter a target between 1 and 100.</p>}
        </div>

        <button type="button" onClick={() => setCalculated(true)} disabled={!targetValid || !allAnswered} className="btn-calculate btn-calculate-hover">
          {!allAnswered ? `Answer the periods above first (${answeredCount}/${ungraded.length})` : 'Can I bunk?'}
        </button>
      </section>

      {result && <ResultCard result={result} />}

      {result && headsUp.length > 0 && (
        <section className="card animate-rise border-l-[length:6px] !border-l-orange bg-warning-bg p-4" role="note">
          <h2 className="heading m-0 mb-2 text-[14px]">Heads up</h2>
          <ul className="m-0 grid list-disc gap-1 pl-5 font-term text-[12px] leading-[1.5]">
            {headsUp.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
      )}

      <section className="card animate-rise p-4 phone:p-5" style={{ animationDelay: '120ms' }}>
        <MonthCalendar timetable={patched} overrides={overrides} />
      </section>

      <details className="card">
        <summary className="heading cursor-pointer p-4 text-[14px]">Data check <span className="font-term text-[11px] font-normal normal-case text-muted">· compare with the portal</span></summary>
        <div className="border-t border-edge p-4">
          <RawDataDump data={data} />
        </div>
      </details>
    </div>
  );
}
