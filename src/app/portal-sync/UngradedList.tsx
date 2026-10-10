'use client';

import { formatDay } from '@/lib/format-date';
import type { PortalTimetableSession } from '@/lib/portal/campx-client';
import { answerKey, type Answer, type SavedAnswers } from '@/lib/portal/saved-answers';

/** The blocking "did you attend?" questions for periods the portal hasn't graded yet. */
export function UngradedList({ sessions, answers, onAnswer }: { sessions: PortalTimetableSession[]; answers: SavedAnswers; onAnswer: (session: PortalTimetableSession, answer: Answer) => void }) {
  const answered = sessions.filter((session) => answers[answerKey(session)]).length;
  const complete = answered === sessions.length;

  return (
    <section className="card animate-rise p-4 phone:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="heading m-0 text-[16px]">Before we calculate</h2>
        <span className={`font-term text-[11px] font-bold ${complete ? 'text-success' : 'text-muted'}`}>{answered} of {sessions.length} answered</span>
      </div>
      <p className="m-0 mb-3 font-term text-[12px] leading-[1.5] text-muted">
        The portal hasn&rsquo;t graded {sessions.length === 1 ? 'this period' : 'these periods'} yet. Did you attend? Your answers are saved on this device.
      </p>
      <div className="grid gap-2">
        {sessions.map((session) => (
          <UngradedRow key={answerKey(session)} session={session} value={answers[answerKey(session)] ?? null} onChange={(answer) => onAnswer(session, answer)} />
        ))}
      </div>
    </section>
  );
}

function UngradedRow({ session, value, onChange }: { session: PortalTimetableSession; value: Answer | null; onChange: (answer: Answer) => void }) {
  return (
    <div className="grid gap-2 rounded-[var(--ui-radius-sm)] border border-edge p-3 phone:grid-cols-[1fr_auto] phone:items-center">
      <div className="min-w-0">
        <p className="m-0 font-term text-[13px] font-bold leading-[1.3]">{session.subjectName}</p>
        <p className="m-0 font-term text-[11px] text-muted">
          {formatDay(session.date)} · {session.fromTime.slice(0, 5)}
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
          className={`chip ${value === 'bunked' ? '!border-error !bg-danger-bg !text-error' : ''}`}
        >
          {value === 'bunked' ? '✕ ' : ''}Bunked
        </button>
      </div>
    </div>
  );
}
