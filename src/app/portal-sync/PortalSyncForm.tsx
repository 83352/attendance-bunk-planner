'use client';

import { useActionState, useMemo, useState } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceResult } from '@/domain/attendance/types';
import type { PortalSyncResult, PortalTimetableSession } from '@/lib/portal/campx-client';
import { buildCalculationInput, findUngradedPastSessions, hasUnscheduledExamGap, type PastOverrides } from '@/lib/portal/to-calculation-input';
import { syncFromPortal, type PortalSyncState } from './actions';

const initialState: PortalSyncState = { status: 'idle' };

/**
 * Logs in with portal credentials, then — unlike the old manual-entry flow —
 * computes the real "how many periods can I bunk" result straight from what
 * the portal already knows: no admin timetable, no Today's Classes tagging.
 * The only thing the student still has to answer is the rare past session
 * the portal itself hasn't graded yet (`findUngradedPastSessions`), plus
 * their own target %. The raw per-field dump stays below, collapsed, for
 * spot-checking the numbers against the real portal pages.
 */
export function PortalSyncForm() {
  const [state, formAction, pending] = useActionState(syncFromPortal, initialState);
  const [rollNumber, setRollNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[720px] border-[3px] border-black bg-paper p-5 shadow-hard">
      <h1 className="m-0 mb-1 font-display text-[22px] font-black uppercase">Can I bunk?</h1>
      <p className="m-0 mb-4 font-term text-[12px] text-muted">
        Your roll number and password are sent once, straight to the portal, to read your attendance and timetable. Nothing is stored.
      </p>
      <form action={formAction} className="grid gap-3">
        <label className="grid gap-1 font-term text-[12px] font-bold text-black">
          Roll number
          <input
            name="rollNumber"
            required
            value={rollNumber}
            // Roll numbers follow ##261A##[A-Z]# — any letters typed in
            // lower case are normalized to upper case as you type.
            onChange={(event) => setRollNumber(event.target.value.toUpperCase())}
            className="min-h-11 border-2 border-black bg-surface px-3 font-sans text-[15px]"
          />
        </label>
        <label className="grid gap-1 font-term text-[12px] font-bold text-black">
          CampX password
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="off"
              className="min-h-11 w-full border-2 border-black bg-surface px-3 pr-14 font-sans text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 min-w-11 cursor-pointer font-term text-[11px] font-bold text-link"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <button type="submit" disabled={pending} className="btn-calculate btn-calculate-hover">
          {pending ? 'Syncing…' : 'Sync'}
        </button>
      </form>

      {state.status === 'error' && (
        <p role="alert" className="mt-4 border-2 border-black bg-danger-bg p-2 font-term text-[12px] font-bold text-error">
          {state.message}
        </p>
      )}

      {state.status === 'success' && <SyncedResult data={state.data} />}
    </div>
  );
}

/** Everything that happens once we have real portal data: ask about ungraded past sessions, then compute and show the result. */
function SyncedResult({ data }: { data: PortalSyncResult }) {
  const now = useMemo(() => new Date(), []);
  const ungraded = useMemo(() => findUngradedPastSessions(data, now), [data, now]);

  const [answers, setAnswers] = useState<Map<number, 'attended' | 'bunked'>>(new Map());
  const [target, setTarget] = useState('75');
  const [calculated, setCalculated] = useState(false);

  const allAnswered = ungraded.every((_, index) => answers.has(index));
  const targetNum = Number(target);
  const targetValid = target.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0 && targetNum <= 100;

  const result: AttendanceResult | null = useMemo(() => {
    if (!calculated || !targetValid || !allAnswered) return null;
    const pastOverrides: PastOverrides = { attended: 0, bunked: 0 };
    for (const status of answers.values()) {
      if (status === 'attended') pastOverrides.attended += 1;
      else pastOverrides.bunked += 1;
    }
    return calculateAttendance(buildCalculationInput(data, targetNum, pastOverrides, now));
  }, [calculated, targetValid, allAnswered, answers, data, targetNum, now]);

  return (
    <div className="mt-5 grid gap-5">
      {ungraded.length > 0 && (
        <section className="border-2 border-black p-3">
          <h2 className="m-0 mb-1 font-display text-[14px] font-black uppercase">Before we calculate</h2>
          <p className="m-0 mb-3 font-term text-[12px] text-muted">
            The portal hasn&rsquo;t graded {ungraded.length} past period{ungraded.length === 1 ? '' : 's'} yet. Did you attend {ungraded.length === 1 ? 'it' : 'them'}?
          </p>
          <div className="grid gap-2">
            {ungraded.map((session, index) => (
              <UngradedRow
                key={index}
                session={session}
                value={answers.get(index) ?? null}
                onChange={(status) => {
                  setAnswers((prev) => {
                    const next = new Map(prev);
                    next.set(index, status);
                    return next;
                  });
                  setCalculated(false);
                }}
              />
            ))}
          </div>
        </section>
      )}

      <label className="grid gap-1 font-term text-[12px] font-bold text-black">
        Target attendance %
        <input
          type="number"
          min="1"
          max="100"
          value={target}
          onChange={(event) => { setTarget(event.target.value); setCalculated(false); }}
          className="min-h-11 w-full max-w-[160px] border-2 border-black bg-surface px-3 font-sans text-[15px]"
        />
      </label>

      <button
        type="button"
        onClick={() => setCalculated(true)}
        disabled={!targetValid || !allAnswered}
        className="btn-calculate btn-calculate-hover"
      >
        {!allAnswered ? 'Answer the periods above first' : 'Can I bunk?'}
      </button>

      {result && <ResultCard result={result} />}
      {result && hasUnscheduledExamGap(now) && (
        <p className="m-0 border-2 border-black bg-warning-bg p-2 font-term text-[12px] leading-[1.4]">
          Mid 2 isn&rsquo;t scheduled on the portal yet — this number doesn&rsquo;t account for it.
        </p>
      )}

      <details className="border-2 border-black">
        <summary className="cursor-pointer p-3 font-term text-[12px] font-bold">Raw synced data (for checking against the portal)</summary>
        <div className="border-t-2 border-black p-3">
          <RawDataDump data={data} />
        </div>
      </details>
    </div>
  );
}

function UngradedRow({ session, value, onChange }: { session: PortalTimetableSession; value: 'attended' | 'bunked' | null; onChange: (status: 'attended' | 'bunked') => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-black/20 p-2 font-term text-[12px]">
      <span>{session.date} · {session.subjectName} · {session.fromTime.slice(0, 5)}</span>
      <div className="flex gap-1">
        <button
          type="button"
          aria-pressed={value === 'attended'}
          onClick={() => onChange('attended')}
          className={`min-h-11 min-w-11 cursor-pointer border-2 border-black px-3 font-bold ${value === 'attended' ? 'bg-lime' : 'bg-surface'}`}
        >
          Attended
        </button>
        <button
          type="button"
          aria-pressed={value === 'bunked'}
          onClick={() => onChange('bunked')}
          className={`min-h-11 min-w-11 cursor-pointer border-2 border-black px-3 font-bold ${value === 'bunked' ? 'bg-danger-bg text-error' : 'bg-surface'}`}
        >
          Bunked
        </button>
      </div>
    </div>
  );
}

const DANGER_RATIO = 0.9;
const CAUTION_RATIO = 0.5;
type Tier = 'lime' | 'yellow' | 'orange' | 'red';
const TIER_STYLES: Record<Tier, string> = {
  lime: 'bg-lime text-[#14261c]',
  yellow: 'bg-hero-yellow text-hero-yellow-ink',
  orange: 'bg-hero-orange text-hero-orange-ink',
  red: 'bg-hero-danger text-hero-danger-ink',
};

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

function ResultCard({ result }: { result: AttendanceResult }) {
  const tier = resultTier(result);
  const needsRecovery = (result.recoveryTo75.periodsRequired ?? 0) > 0;
  return (
    <section className={`border-[3px] border-black shadow-hard ${TIER_STYLES[tier]}`}>
      <div className="p-5">
        {needsRecovery ? (
          <>
            <p className="m-0 mb-1 font-term text-[12px] font-bold">Attendance recovery</p>
            <div className="font-display text-[64px] leading-[.85] font-black">{result.recoveryTo75.periodsRequired}</div>
            <p className="m-0 mt-2 font-term text-[13px] font-bold">
              {result.recoveryTo75.reachable
                ? <>classes in a row to reach 75% (about {result.recoveryTo75.minimumCollegeDays} college days)</>
                : <>Not reachable this semester — best finish is {result.recoveryTo75.bestAchievablePercentage.toFixed(2)}%</>}
            </p>
          </>
        ) : (
          <>
            <div className="font-display text-[64px] leading-[.85] font-black">{result.maximumBunks}</div>
            <p className="m-0 mt-2 font-term text-[13px] font-bold">periods you can bunk and still land at {result.finalPercentageAtMaximumBunks.toFixed(2)}%</p>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-px border-t-[3px] border-black bg-black">
        <Stat label="Held so far" value={String(result.heldSoFar)} note={`${result.updatedCurrentPercentage.toFixed(2)}%`} />
        <Stat label="Periods left" value={String(result.remainingPeriods)} note={`${result.teachingWeeks} teaching weeks`} />
        <Stat label="Days you can miss" value={String(result.maximumFullDaysAbsent)} note="full days off" />
        <Stat label="Bunks per week" value={result.periodsPerWeek.toFixed(1)} note="on average" />
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-paper p-3">
      <span className="block font-display text-[12px] font-black uppercase text-black">{label}</span>
      <strong className="mt-1 block font-display text-[22px] font-black">{value}</strong>
      <small className="block font-term text-[11px] text-muted">{note}</small>
    </div>
  );
}

/** Every field the portal gave us, grouped by endpoint — for checking by eye against the portal's own pages. */
function RawDataDump({ data }: { data: PortalSyncResult }) {
  return (
    <div className="grid gap-5 font-term text-[12px]">
      <Section title={`Current semester (auto-detected): ${data.currentSemNo}`}>
        <p className="m-0 text-muted">Not typed anywhere — read from the portal&rsquo;s own my-all-semester-attendance response.</p>
      </Section>

      <Section title="Primary attendance (my-secondary-attendance)">
        <Table rows={Object.entries(data.primaryAttendance)} />
      </Section>

      <Section title={`Semester summary — ${data.semesterSummary.subjects.length} subjects, class average ${data.semesterSummary.classAverage}%, overall ${data.semesterSummary.overallAttendance}%`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-1 pr-2">Subject</th>
                <th className="py-1 pr-2">Present</th>
                <th className="py-1 pr-2">Classes</th>
                <th className="py-1 pr-2">%</th>
              </tr>
            </thead>
            <tbody>
              {data.semesterSummary.subjects.map((subject) => (
                <tr key={subject.subjectName} className="border-b border-black/10">
                  <td className="py-1 pr-2">{subject.subjectName}</td>
                  <td className="py-1 pr-2">{subject.present}</td>
                  <td className="py-1 pr-2">{subject.numberOfClasses}</td>
                  <td className="py-1 pr-2">{subject.percentage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Date-wise attendance — ${Object.keys(data.dateWiseAttendance).length} days recorded this month`}>
        <Table rows={Object.entries(data.dateWiseAttendance)} />
      </Section>

      <Section title={`Timetable (this semester, own sessions only) — ${data.timetable.length} sessions`}>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-paper">
              <tr className="border-b-2 border-black">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Day</th>
                <th className="py-1 pr-2">Time</th>
                <th className="py-1 pr-2">Periods</th>
                <th className="py-1 pr-2">Subject</th>
                <th className="py-1 pr-2">Group</th>
                <th className="py-1 pr-2">Suspended</th>
                <th className="py-1 pr-2">Attended</th>
              </tr>
            </thead>
            <tbody>
              {data.timetable.map((session, index) => (
                <tr key={index} className="border-b border-black/10">
                  <td className="py-1 pr-2 whitespace-nowrap">{session.date}</td>
                  <td className="py-1 pr-2">{session.day.slice(0, 3)}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{session.fromTime.slice(0, 5)}–{session.toTime.slice(0, 5)}</td>
                  <td className="py-1 pr-2">{session.periods.join(',')}</td>
                  <td className="py-1 pr-2">{session.subjectName}</td>
                  <td className="py-1 pr-2">{session.groupName ?? '—'}</td>
                  <td className="py-1 pr-2">{session.isSuspended ? 'yes' : ''}</td>
                  <td className="py-1 pr-2">{session.attended === null ? '—' : session.attended ? 'present' : 'absent'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-black p-3">
      <h2 className="m-0 mb-2 font-display text-[14px] font-black uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: [string, unknown][] }) {
  return (
    <table className="w-full border-collapse text-left">
      <tbody>
        {rows.map(([key, value]) => (
          <tr key={key} className="border-b border-black/10">
            <td className="py-1 pr-3 font-bold">{key}</td>
            <td className="py-1 text-muted">{String(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
