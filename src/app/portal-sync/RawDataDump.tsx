import { formatDay } from '@/lib/format-date';
import type { PortalSyncResult } from '@/lib/portal/campx-client';

/** Every field the portal gave us, grouped by endpoint — for checking by eye against the portal's own pages. */
export function RawDataDump({ data }: { data: PortalSyncResult }) {
  return (
    <div className="grid gap-4 font-term text-[12px]">
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
              <tr className="border-b-2 border-edge">
                <th className="py-1 pr-2">Subject</th>
                <th className="py-1 pr-2">Present</th>
                <th className="py-1 pr-2">Classes</th>
                <th className="py-1 pr-2">%</th>
              </tr>
            </thead>
            <tbody>
              {data.semesterSummary.subjects.map((subject) => (
                <tr key={subject.subjectName} className="border-b border-edge/50 even:bg-cream/60">
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
        <Table rows={Object.entries(data.dateWiseAttendance).map(([date, status]) => [formatDay(date), status])} />
      </Section>

      <Section title={`Timetable (this semester, own sessions only) — ${data.timetable.length} sessions`}>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-paper">
              <tr className="border-b-2 border-edge">
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
                <tr key={index} className="border-b border-edge/50 even:bg-cream/60">
                  <td className="py-1 pr-2 whitespace-nowrap">{formatDay(session.date)}</td>
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
    <section className="min-w-0 rounded-[var(--ui-radius-sm)] border border-edge p-3">
      <h3 className="heading m-0 mb-2 text-[13px]">{title}</h3>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: [string, unknown][] }) {
  return (
    <table className="w-full border-collapse text-left">
      <tbody>
        {rows.map(([key, value]) => (
          <tr key={key} className="border-b border-edge/50 even:bg-cream/60">
            <td className="py-1 pr-3 font-bold">{key}</td>
            <td className="py-1 text-muted">{String(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
