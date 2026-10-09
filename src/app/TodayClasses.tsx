import React from 'react';
import type { DatedPeriod } from '@/domain/schedule/types';
import { PeriodHelp } from './PeriodHelp';
import { PeriodToggles, type ThreeStateValue } from './PeriodToggles';

type TodayClassesProps = {
  /** Today's periods from the calendar (calendar.today) */
  periods: DatedPeriod[];
  /** Current IST time as HH:MM string */
  currentIstTime: string;
  /**
   * Map of period sequence -> boolean | 'auto' for completed/ongoing periods.
   * 'auto' = already in portal %, true = attended, false = bunked.
   * Absent = untagged (blank).
   */
  todayValues: Map<number, boolean | 'auto'>;
  /** Map of period sequence -> boolean for upcoming periods. true = attending (default). */
  upcomingValues: Map<number, boolean>;
  /** Called when a completed/ongoing period is toggled */
  onTodayChange: (sequence: number, value: boolean | 'auto' | null) => void;
  /** Called when an upcoming period is toggled */
  onUpcomingChange: (sequence: number, attending: boolean) => void;
  /** Number of completed/ongoing periods left untagged — drives the compulsory tagging message. */
  untaggedCount: number;
};

export function TodayClasses({
  periods,
  currentIstTime,
  todayValues,
  upcomingValues,
  onTodayChange,
  onUpcomingChange,
  untaggedCount,
}: TodayClassesProps) {
  const [expanded, setExpanded] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  if (periods.length === 0) return null;

  const completed: DatedPeriod[] = [];
  const ongoing: DatedPeriod[] = [];
  const upcoming: DatedPeriod[] = [];
  let ongoingSequence: number | null = null;

  for (const p of periods) {
    // Exam periods (full-day) always go into completed
    if (p.start === '00:00' && p.end === '23:59') {
      completed.push(p);
      continue;
    }

    if (currentIstTime < p.start) {
      // Not yet started → upcoming
      upcoming.push(p);
    } else if (currentIstTime < p.end) {
      // Ongoing
      ongoing.push(p);
      ongoingSequence = p.sequence;
    } else {
      // Completed
      completed.push(p);
    }
  }

  const weekday = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
  }).format(new Date(`${periods[0].date}T00:00:00Z`));

  const parts = [];
  if (completed.length > 0) parts.push(`${completed.length} completed`);
  if (ongoing.length > 0) parts.push(`${ongoing.length} ongoing`);
  if (upcoming.length > 0) parts.push(`${upcoming.length} upcoming`);
  const summary = `${periods.length} period${periods.length === 1 ? '' : 's'} · ${parts.join(', ')}`;

  // Completed/ongoing periods use three-state: auto | attended | bunked.
  // PeriodToggles.onChange returns ThreeStateValue | boolean; in three-state
  // mode it will be ThreeStateValue. Map to the values TodayClasses exposes.
  const handleCompletedToggle = (sequence: number, value: ThreeStateValue | boolean) => {
    if (value === 'updated') {
      // Deselected — back to blank (null signals "remove from map")
      onTodayChange(sequence, null);
    } else if (value === 'attended') {
      onTodayChange(sequence, true);
    } else if (value === 'bunked') {
      onTodayChange(sequence, false);
    } else if (value === 'auto') {
      onTodayChange(sequence, 'auto');
    }
  };

  // Upcoming periods use two-state: attending | bunking.
  const handleUpcomingToggle = (sequence: number, value: ThreeStateValue | boolean) => {
    onUpcomingChange(sequence, value as boolean);
  };

  // Build the values map for PeriodToggles (three-state) from todayValues.
  // todayValues:  true -> 'attended', false -> 'bunked', 'auto' -> 'auto', absent -> 'updated' (blank)
  const completedToggleValues = new Map<number, ThreeStateValue>();
  for (const p of [...completed, ...ongoing]) {
    const v = todayValues.get(p.sequence);
    if (v === true) completedToggleValues.set(p.sequence, 'attended');
    else if (v === false) completedToggleValues.set(p.sequence, 'bunked');
    else if (v === 'auto') completedToggleValues.set(p.sequence, 'auto');
    // else: absent → 'updated' (PeriodToggles default)
  }

  const untaggedSequences = [...completed, ...ongoing].filter((p) => !todayValues.has(p.sequence)).map((p) => p.sequence);

  return (
    <div className={`flex flex-col border-[3px] border-black transition-all duration-150 bg-[#f0ece1]/50 ${
      !expanded && isPressed ? 'translate-y-[3px] translate-x-[3px] shadow-[1px_1px_0_var(--shadow-color)]' : 
      !expanded && isHovered ? '-translate-y-[2px] -translate-x-[2px] shadow-[6px_6px_0_var(--shadow-color)]' : 
      'shadow-[4px_4px_0_var(--shadow-color)]'
    }`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setIsHovered(true); }}
        onPointerLeave={() => { setIsHovered(false); setIsPressed(false); }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        className={`flex w-full cursor-pointer items-center justify-between bg-surface px-[clamp(16px,2vw,20px)] py-[clamp(12px,1.5vw,16px)] transition-colors hover:bg-lime hover:text-black ${expanded ? 'border-b-[3px] border-black' : ''}`}
        aria-expanded={expanded}
      >
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-baseline gap-2">
            <h2 className="m-0 font-term text-[14px] font-black text-inherit">
              Today&apos;s Classes
            </h2>
            <span className="font-term text-[12px] font-black opacity-70">
              {weekday}
            </span>
          </div>
          <span className="font-term text-[12px] opacity-70">{summary}</span>
        </div>
        <span aria-hidden="true" className="font-display text-[24px] leading-none font-black uppercase">{expanded ? '−' : '+'}</span>
      </button>

      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out" 
        style={{ height: expanded ? 'auto' : 0 }}
      >
        <div>
          <div className="px-[clamp(16px,2vw,20px)] pb-[clamp(16px,2vw,20px)] pt-3">
            {/* Requested horizontal line */}
            <div className="mb-2 mt-1 h-[2px] bg-black/20" />

            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
              <PeriodHelp />
              {untaggedSequences.length > 0 && (
                <button
                  type="button"
                  onClick={() => untaggedSequences.forEach((sequence) => onTodayChange(sequence, 'auto'))}
                  className="min-h-[34px] cursor-pointer border-2 border-black bg-surface px-3 font-term text-[12px] font-bold text-black shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]"
                >
                  Mark all Auto
                </button>
              )}
            </div>
            
            {/* Completed section */}
            {completed.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center font-term text-[12px] font-bold text-muted">
                  Completed
                </p>
                <PeriodToggles
                  periods={completed}
                  mode="three-state"
                  isPast={true}
                  values={completedToggleValues}
                  onChange={handleCompletedToggle}
                />
              </div>
            )}

            {/* Ongoing section */}
            {ongoing.length > 0 && (
              <div className={completed.length > 0 ? 'mt-4' : undefined}>
                <p className="mb-1.5 flex items-center font-term text-[12px] font-bold text-muted">
                  Ongoing
                </p>
                <PeriodToggles
                  periods={ongoing}
                  mode="three-state"
                  isPast={true}
                  values={completedToggleValues}
                  onChange={handleCompletedToggle}
                  ongoingSequence={ongoingSequence ?? undefined}
                />
              </div>
            )}

            {/* Upcoming section — two-state, default attending */}
            {upcoming.length > 0 && (
              <div className={completed.length > 0 ? 'mt-4' : undefined}>
                <p className="mb-1.5 font-term text-[12px] font-bold text-muted">
                  Upcoming
                </p>
                <PeriodToggles
                  periods={upcoming}
                  mode="two-state"
                  values={upcomingValues}
                  onChange={handleUpcomingToggle}
                />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
