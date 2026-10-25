'use client';

import { useRef, useState } from 'react';
import { subjectRows } from '@/lib/portal/subject-status';
import { fetchSubjects, type SubjectsState } from './actions';

type Phase = 'idle' | 'loading' | 'waiting' | SubjectsState['status'];

/** After this long we stop showing a plain loader and say CampX is being slow. */
const SLOW_NOTICE_MS = 8_000;

/**
 * Every subject's attendance against the target, lowest first. A closed
 * dropdown: the portal's per-subject summary is its slowest call (30-90 s
 * lately), so it is only fetched when the student opens this, never with the
 * first screen.
 */
export function SubjectsCard({ semNo, target, onLateIssue, delayMs = 0 }: { semNo: number; target: number; /** Entrance delay, so it arrives just after the result. */ delayMs?: number; onLateIssue: (kind: 'no-cookie' | 'rejected' | 'maintenance') => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [subjects, setSubjects] = useState<Extract<SubjectsState, { status: 'ready' }>['subjects']>([]);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setPhase('loading');
    slowTimer.current = setTimeout(() => setPhase((current) => (current === 'loading' ? 'waiting' : current)), SLOW_NOTICE_MS);
    const result = await fetchSubjects(semNo);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (result.status === 'ready') setSubjects(result.subjects);
    // These two replace the whole page (back to sign-in, or the maintenance notice), so they're handed up.
    if (result.status === 'expired') return onLateIssue(result.why);
    if (result.status === 'maintenance') return onLateIssue('maintenance');
    setPhase(result.status);
  };

  const rows = subjectRows(subjects, target);
  const below = rows.filter((row) => row.belowTarget).length;
  const busy = phase === 'loading' || phase === 'waiting';

  return (
    <details
      className="group card animate-rise"
      style={{ animationDelay: `${delayMs}ms` }}
      onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open && phase === 'idle') void load(); }}
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 p-4 phone:px-5">
        <span className="heading text-[17px]">Subjects</span>
        <span className={`font-term text-[12px] font-bold ${phase === 'ready' ? (below > 0 ? 'text-error' : 'text-success') : 'text-muted'}`}>
          {phase === 'ready' ? (below > 0 ? `${below} below ${target}%` : `All at or above ${target}%`) : 'See each subject'}
          <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-200 group-open:rotate-180">▾</span>
        </span>
      </summary>

      <div className="border-t border-edge p-4 phone:p-5">
        {busy && (
          <div role="status" aria-live="polite" className="grid gap-3">
            <div className="h-0.5 overflow-hidden rounded-full bg-edge/40" aria-hidden="true">
              <div className="indeterminate-bar h-full w-1/3 rounded-full bg-link" />
            </div>
            <p className="m-0 flex items-center gap-2 font-term text-[13px] text-muted">
              {phase === 'waiting' ? 'CampX is taking longer than usual' : 'Loading your subjects'}
              <span aria-hidden="true" className="inline-flex gap-1">
                <i className="dot-pulse" /><i className="dot-pulse" style={{ animationDelay: '.15s' }} /><i className="dot-pulse" style={{ animationDelay: '.3s' }} />
              </span>
            </p>
            {phase === 'waiting' && <p className="m-0 font-term text-[12px] text-muted">Their subject summary is slow today. Your result above doesn&rsquo;t depend on it, so you can keep this open or come back.</p>}
            <div className="grid gap-2" aria-hidden="true">
              {[0, 1, 2].map((index) => <div key={index} className="shimmer h-[58px]" style={{ animationDelay: `${index * 0.12}s` }} />)}
            </div>
          </div>
        )}

        {(phase === 'slow' || phase === 'error') && (
          <div role="alert" className="animate-rise grid justify-items-start gap-3 font-term text-[13px] leading-[1.5]">
            <p className="m-0">{phase === 'slow' ? 'CampX didn’t answer in time. Their subject summary is very slow right now.' : 'Couldn’t load the subjects.'}</p>
            <button type="button" onClick={() => void load()} className="chip">Try again</button>
          </div>
        )}

        {phase === 'ready' && (
          <ul className="m-0 grid list-none gap-2 p-0">
            {rows.map((row, index) => (
              <li key={row.name} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }} className={`animate-rise rounded-[var(--ui-radius-sm)] border p-3 ${row.belowTarget ? 'border-error bg-danger-bg' : 'border-edge'}`}>
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
        )}
      </div>
    </details>
  );
}
