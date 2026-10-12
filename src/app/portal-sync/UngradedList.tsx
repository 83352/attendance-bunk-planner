'use client';

import { useState } from 'react';
import { formatDay } from '@/lib/format-date';
import type { PortalTimetableSession } from '@/lib/portal/campx-client';
import { answerKey, type Answer, type SavedAnswers } from '@/lib/portal/saved-answers';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The required "did you attend?" questions for periods the portal hasn't
 * graded yet. The result stays locked until every one is answered; once they
 * are, the card collapses to a one-line summary (answers can still be changed).
 */
export function UngradedList({ sessions, periodCount, answers, onAnswer }: { sessions: PortalTimetableSession[]; /** Periods across all sessions: a double period counts as 2. */ periodCount: number; answers: SavedAnswers; onAnswer: (session: PortalTimetableSession, answer: Answer) => void }) {
  const answered = sessions.filter((session) => answers[answerKey(session)]).length;
  const complete = answered === sessions.length;
  const [editing, setEditing] = useState(false);
  const what = periodCount === sessions.length ? plural(sessions.length, 'period') : `${plural(periodCount, 'period')} in ${plural(sessions.length, 'class')}`;

  if (complete && !editing) {
    return (
      <section className="card animate-rise flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="m-0 flex items-center gap-2 text-[15px] leading-[1.4]">
          <span aria-hidden="true" className="font-bold text-success">✓</span>
          <span><strong>{what}</strong> the portal hasn&rsquo;t marked yet: answered</span>
        </p>
        <button type="button" onClick={() => setEditing(true)} className="chip" aria-expanded={false}>Change answers</button>
      </section>
    );
  }

  return (
    <section className="card animate-rise p-4 phone:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="heading m-0 text-[18px]">Required: did you attend these?</h2>
        <span className={`font-term text-[13px] font-bold ${complete ? 'text-success' : 'text-muted'}`}>{answered} of {sessions.length} answered</span>
      </div>
      <p className="m-0 mb-3 text-[15px] leading-[1.5] text-muted">
        The portal hasn&rsquo;t marked {what} yet. Your result unlocks once you answer {sessions.length === 1 ? 'it' : 'all of them'}, so the number is exact. Answers stay on this device.
      </p>
      <div className="grid gap-2">
        {sessions.map((session) => (
          <UngradedRow key={answerKey(session)} session={session} value={answers[answerKey(session)] ?? null} onChange={(answer) => onAnswer(session, answer)} />
        ))}
      </div>
      {complete && (
        <button type="button" onClick={() => setEditing(false)} className="chip mt-3" aria-expanded>Done</button>
      )}
    </section>
  );
}

function UngradedRow({ session, value, onChange }: { session: PortalTimetableSession; value: Answer | null; onChange: (answer: Answer) => void }) {
  const periods = session.periods.length;
  return (
    <div className="grid gap-2 rounded-[var(--ui-radius-sm)] border border-edge p-3 phone:grid-cols-[1fr_auto] phone:items-center">
      <div className="min-w-0">
        <p className="m-0 text-[15px] font-bold leading-[1.3]">{session.subjectName}</p>
        <p className="m-0 font-term text-[13px] text-muted">
          {formatDay(session.date)} · {session.fromTime.slice(0, 5)}
          {periods > 1 ? ` · ${periods} periods` : ''}
          {session.synthetic ? ' · not on the portal yet' : ''}
        </p>
      </div>
      <div role="group" aria-label={`Did you attend ${session.subjectName} on ${formatDay(session.date)}?`} className="grid grid-cols-2 gap-1.5 phone:flex">
        <button
          type="button"
          aria-pressed={value === 'attended'}
          onClick={() => onChange('attended')}
          className={`chip ${value === 'attended' ? '!border-present !bg-present-bg !text-present' : ''}`}
        >
          {value === 'attended' ? '✓ ' : ''}Attended
        </button>
        <button
          type="button"
          aria-pressed={value === 'bunked'}
          onClick={() => onChange('bunked')}
          className={`chip ${value === 'bunked' ? '!border-amber !bg-bunked-bg !text-bunked-ink' : ''}`}
        >
          {value === 'bunked' ? '✕ ' : ''}Bunked
        </button>
      </div>
    </div>
  );
}
