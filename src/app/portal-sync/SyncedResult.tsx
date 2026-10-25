'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { CalendarOverrides } from '@/lib/portal/calendar-overrides';
import type { PortalSyncResult, PortalTimetableSession } from '@/lib/portal/campx-client';
import { answerKey, parseAnswers, pruneAnswers, readRawAnswers, saveAnswer, subscribeSaved, type Answer } from '@/lib/portal/saved-answers';
import {
  buildCalculationInput,
  describeActivePatches,
  findUngradedPastSessions,
  hasUnscheduledExamGap,
  pastOverridesFromAnswers,
  patchedTimetable,
} from '@/lib/portal/to-calculation-input';
import { SHOW_DATA_CHECK } from '@/lib/data-check';
import { MonthCalendar } from '../MonthCalendar';
import { RawDataDump } from './RawDataDump';
import { SubjectsCard } from './SubjectsCard';
import { ResultCard } from './ResultCard';
import { resultTier } from './result-tier';
import { UngradedList } from './UngradedList';

/** The college minimum. Every student is judged on it, so it's the only target the page works with. */
const TARGET = 75;

/** Everything that happens once we have real portal data: ask about ungraded past sessions, then compute and show the result. */
export function SyncedResult({ data, overrides, onLateIssue }: { data: PortalSyncResult; overrides: CalendarOverrides | null; /** The subjects list found the sign-in expired, or the portal changed shape. */ onLateIssue: (kind: 'expired' | 'maintenance') => void }) {
  const now = useMemo(() => new Date(), []);
  const ungraded = useMemo(() => findUngradedPastSessions(data, now, overrides), [data, now, overrides]);
  const patched = useMemo(() => patchedTimetable(data, overrides, now), [data, overrides, now]);
  const patchNotes = useMemo(() => describeActivePatches(data, overrides, now), [data, overrides, now]);

  // Answers live in localStorage (so they survive a reload) and are read
  // through useSyncExternalStore: the server snapshot is "nothing saved", so
  // this view can be server-rendered without a hydration mismatch.
  const rawAnswers = useSyncExternalStore(subscribeSaved, readRawAnswers, () => null);
  const answers = useMemo(() => pruneAnswers(parseAnswers(rawAnswers), ungraded.map(answerKey)), [rawAnswers, ungraded]);

  const answeredCount = ungraded.filter((session) => answers[answerKey(session)]).length;
  const allAnswered = answeredCount === ungraded.length;
  const periodsToAnswer = ungraded.reduce((sum, session) => sum + Math.max(1, session.periods.length), 0);

  // Shows as soon as every unmarked period is answered (immediately if there
  // are none). Answers are counted in periods, so a double period counts twice.
  const { result, tier } = useMemo(() => {
    if (!allAnswered) return { result: null, tier: null };
    const atTarget = calculateAttendance(buildCalculationInput(data, TARGET, pastOverridesFromAnswers(ungraded, answers), now, overrides));
    return { result: atTarget, tier: resultTier(atTarget) };
  }, [allAnswered, answers, ungraded, data, now, overrides]);

  const onAnswer = (session: PortalTimetableSession, answer: Answer) => {
    saveAnswer(answerKey(session), answer, ungraded.map(answerKey));
  };

  // The calendar shows the student's own answers as if the portal had marked those periods,
  // and flags only the days that still need one.
  const ungradedKeys = useMemo(() => new Set(ungraded.map(answerKey)), [ungraded]);
  const calendarTimetable = useMemo(
    () => patched.map((session) => {
      const answer = ungradedKeys.has(answerKey(session)) ? answers[answerKey(session)] : undefined;
      return answer ? { ...session, attended: answer === 'attended' } : session;
    }),
    [patched, ungradedKeys, answers],
  );
  const needsAnswerDates = useMemo(
    () => new Set(ungraded.filter((session) => !answers[answerKey(session)]).map((session) => session.date)),
    [ungraded, answers],
  );

  const headsUp = [
    ...patchNotes,
    ...(!overrides ? ['There is no manual calendar for your year, so holidays and exams the portal has not published yet are not accounted for.'] : []),
    ...(hasUnscheduledExamGap(now, overrides) ? ['The next exam is not scheduled yet, so this number does not account for it.'] : []),
  ];

  return (
    <div className="grid gap-5">
      {ungraded.length > 0 && <UngradedList sessions={ungraded} periodCount={periodsToAnswer} answers={answers} onAnswer={onAnswer} />}

      {result && tier ? (
        <ResultCard result={result} tier={tier} />
      ) : (
        <section className="card animate-rise p-5" role="status">
          <p className="heading m-0 flex items-center gap-2 text-[18px]"><span aria-hidden="true">🔒</span> Your result is locked</p>
          <p className="m-0 mt-1.5 text-[15px] leading-[1.5] text-muted">
            Answer the {ungraded.length === 1 ? 'class' : `${ungraded.length} classes`} above to unlock it ({answeredCount} of {ungraded.length} done).
            Every answer is needed so the number is exact.
          </p>
        </section>
      )}

      <SubjectsCard semNo={data.currentSemNo} target={TARGET} onLateIssue={onLateIssue} />

      {result && headsUp.length > 0 && (
        <section className="card animate-rise border-l-[length:6px] !border-l-orange bg-warning-bg p-4" role="note">
          <h2 className="heading m-0 mb-2 text-[15px]">Heads up</h2>
          <ul className="m-0 grid list-disc gap-1 pl-5 font-term text-[13px] leading-[1.5]">
            {headsUp.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
      )}

      <section className="card animate-rise p-4 phone:p-5" style={{ animationDelay: '120ms' }}>
        <MonthCalendar
          timetable={calendarTimetable}
          overrides={overrides}
          needsAnswerDates={needsAnswerDates}
          answerableKeys={ungradedKeys}
          onAnswer={onAnswer}
        />
      </section>

      {SHOW_DATA_CHECK && <details className="card">
        <summary className="heading cursor-pointer p-4 text-[15px]">Data check <span className="font-term text-[12px] font-normal normal-case text-muted">· compare with the portal</span></summary>
        <div className="border-t border-edge p-4">
          <RawDataDump data={data} />
        </div>
      </details>}
    </div>
  );
}
