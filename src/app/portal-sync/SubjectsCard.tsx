import { subjectRows } from '@/lib/portal/subject-status';
import type { PortalSubjectAttendance } from '@/lib/portal/campx-client';

/** Every subject's attendance against the target, lowest first, so the ones that need attention come first. */
export function SubjectsCard({ subjects, target }: { subjects: PortalSubjectAttendance[]; target: number }) {
  const rows = subjectRows(subjects, target);
  if (rows.length === 0) return null;
  const below = rows.filter((row) => row.belowTarget).length;

  return (
    <section className="card animate-rise p-4 phone:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="heading m-0 text-[17px]">Subjects</h2>
        <span className={`font-term text-[12px] font-bold ${below > 0 ? 'text-error' : 'text-success'}`}>
          {below > 0 ? `${below} below ${target}%` : `All at or above ${target}%`}
        </span>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0">
        {rows.map((row) => (
          <li key={row.name} className={`rounded-[var(--ui-radius-sm)] border p-3 ${row.belowTarget ? 'border-error bg-danger-bg' : 'border-edge'}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`font-term text-[14px] font-bold leading-[1.3] ${row.belowTarget ? 'text-error' : ''}`}>{row.name}</span>
              <span className={`shrink-0 font-term text-[14px] font-bold tabular-nums ${row.belowTarget ? 'text-error' : ''}`}>{row.percentage.toFixed(1)}%</span>
            </div>
            <p className={`m-0 mt-0.5 font-term text-[12px] ${row.belowTarget ? 'text-error' : 'text-muted'}`}>
              {row.attended} of {row.held} attended
              {row.belowTarget && (row.classesNeeded === null ? ' · can’t reach this target' : ` · needs ${row.classesNeeded} more ${row.classesNeeded === 1 ? 'class' : 'classes'} in a row`)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
