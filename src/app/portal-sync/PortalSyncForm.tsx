'use client';

import { useActionState, useState } from 'react';
import type { PortalSyncResult } from '@/lib/portal/campx-client';
import { syncFromPortal, type PortalSyncState } from './actions';

const initialState: PortalSyncState = { status: 'idle' };

/**
 * Phase-1 vertical slice: log in with portal credentials and show every
 * field we get back, raw — so each one can be checked against what the
 * portal itself shows before anything is trusted enough to feed into the
 * real bunk-calculation engine. It is not yet wired into the Calculator
 * card, and it does not yet remove the old manual-entry flow.
 */
export function PortalSyncForm() {
  const [state, formAction, pending] = useActionState(syncFromPortal, initialState);
  const [rollNumber, setRollNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[720px] border-[3px] border-black bg-paper p-5 shadow-hard">
      <h1 className="m-0 mb-1 font-display text-[22px] font-black uppercase">Sync from portal</h1>
      <p className="m-0 mb-4 font-term text-[12px] text-muted">
        Your roll number and password are sent once, straight to the portal, to read your attendance and timetable. Nothing is stored. Your semester is read from the portal itself — not typed.
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

      {state.status === 'success' && <RawDataDump data={state.data} />}
    </div>
  );
}

/**
 * Dumps every field the portal gave us, grouped by endpoint, so each one can
 * be checked by eye against the portal's own pages. This is a verification
 * tool, not the real UI — once the data is trusted, this gets replaced by
 * the actual Calculator card reading from it.
 */
function RawDataDump({ data }: { data: PortalSyncResult }) {
  return (
    <div className="mt-5 grid gap-5 font-term text-[12px]">
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
