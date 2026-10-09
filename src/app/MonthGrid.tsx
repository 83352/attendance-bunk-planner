'use client';

import { useEffect, useRef } from 'react';
import { periodsForDate, type MonthCalendarData } from '@/domain/schedule/calendar';
import type { ScheduleConfig } from '@/domain/schedule/types';
import { PeriodHelp } from './PeriodHelp';
import { PeriodToggles, type ThreeStateValue } from './PeriodToggles';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const dayLabelFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

type MonthGridProps = {
  data: MonthCalendarData;
  showHeading?: boolean;
  /** Draw the bordered card around the grid. Off when a parent already supplies the box. */
  framed?: boolean;
  /** Currently expanded day ISO string, if any. */
  expandedDay?: string | null;
  /** Called when a tappable day cell is clicked. */
  onDayClick?: (iso: string) => void;
  /** Period overrides keyed by "date:sequence" -> 'attended' | 'bunked'. */
  overrides?: Map<string, 'attended' | 'bunked'>;
  /** Called when user changes a period override in the expanded day. */
  onOverrideChange?: (date: string, sequence: number, status: 'attended' | 'bunked' | null) => void;
  /** ISO date for today — cells on or after this are not tappable for overrides. */
  todayIso?: string;
  /** Schedule config, needed to look up periods for the expanded day. */
  config?: ScheduleConfig;
  /** When set, today's cell becomes a button that calls this (today is edited under Today's Classes, not in the day popup). */
  onTodayClick?: () => void;
};

/**
 * One month's day grid: period count, and colored markers for holidays,
 * exams, and working Saturdays. Shared by the admin's stacked semester view
 * and the public single-month calendar so both always look identical.
 *
 * When `onDayClick` / `config` are provided, past day cells become tappable
 * and expand inline to show period-level override toggles.
 */
export function MonthGrid({
  data,
  showHeading = true,
  framed = true,
  expandedDay,
  onDayClick,
  overrides,
  onOverrideChange,
  todayIso,
  config,
  onTodayClick,
}: MonthGridProps) {
  const { year, month, blanks, dayCells } = data;

  // Group cells into week rows (arrays of 7, padded with nulls for blanks).
  const rows: (typeof dayCells[number] | null)[][] = [];
  const paddedCells: (typeof dayCells[number] | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...dayCells,
  ];
  for (let i = 0; i < paddedCells.length; i += 7) {
    rows.push(paddedCells.slice(i, i + 7));
  }

  const expandedCell = expandedDay ? dayCells.find((cell) => cell.iso === expandedDay) : undefined;

  return (
    <div className={framed ? 'border-[3px] border-black bg-surface p-3 shadow-hard phone:p-5' : undefined}>
      {showHeading && <div className="mb-3 font-term text-[13px] leading-[1.2] font-extrabold text-teal">{MONTH_NAMES[month]} {year}</div>}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => <span key={label} className="py-1 text-center font-term text-[12px] font-bold text-muted">{label}</span>)}
      </div>
      {rows.map((row, rowIndex) => {
        return (
          <div key={rowIndex}>
            <div className="grid grid-cols-7 gap-1">
              {row.map((cell, colIndex) => {
                if (!cell) return <span key={`b${rowIndex}-${colIndex}`} />;
                return (
                  <DayCell
                    key={cell.day}
                    cell={cell}
                    todayIso={todayIso}
                    isExpanded={cell.iso === expandedDay}
                    isTappable={!!onDayClick && !!todayIso && cell.inSemester && cell.iso !== todayIso && cell.count > 0}
                    hasOverrides={overrides ? hasOverridesForDate(overrides, cell.iso) : false}
                    plannedBunks={overrides && todayIso && cell.iso > todayIso ? plannedBunksForDate(overrides, cell.iso) : 0}
                    onDayClick={onDayClick}
                    onTodayClick={onTodayClick}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {expandedCell && config && onOverrideChange && todayIso && onDayClick && (
        <DayExpansion
          key={expandedCell.iso}
          iso={expandedCell.iso}
          cell={expandedCell}
          config={config}
          todayIso={todayIso}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
          onClose={() => onDayClick(expandedCell.iso)}
        />
      )}
    </div>
  );
}

/** Bunks planned on a day that hasn't happened yet. */
function plannedBunksForDate(overrides: Map<string, 'attended' | 'bunked'>, date: string): number {
  let count = 0;
  for (const [key, status] of overrides) {
    if (status === 'bunked' && key.startsWith(`${date}:`)) count += 1;
  }
  return count;
}

function hasOverridesForDate(overrides: Map<string, 'attended' | 'bunked'>, date: string): boolean {
  for (const key of overrides.keys()) {
    if (key.startsWith(`${date}:`)) return true;
  }
  return false;
}

type DayCellProps = {
  cell: MonthCalendarData['dayCells'][number];
  isExpanded: boolean;
  isTappable: boolean;
  hasOverrides: boolean;
  /** Bunks planned on this (future) day; 0 when none. */
  plannedBunks: number;
  todayIso?: string;
  onDayClick?: (iso: string) => void;
  onTodayClick?: () => void;
};

function DayCell({ cell, isExpanded, isTappable, hasOverrides, plannedBunks, todayIso, onDayClick, onTodayClick }: DayCellProps) {
  const { day, iso, count, inSemester, isHoliday, isExam, isSpecialSaturday, isToday, holidayName, examName } = cell;

  const isPast = todayIso ? iso < todayIso : false;

  // Quiet by default: ordinary days are hairline-boxed, past days recede, and
  // only exceptions (holiday / exam / working Saturday) and today carry colour.
  let className = 'relative flex min-h-11 flex-col items-center justify-center border-[1.5px] text-[12px] transition-transform';
  if (!inSemester || (count === 0 && !isHoliday && !isExam && !isSpecialSaturday)) className += ' border-transparent bg-transparent text-muted opacity-40';
  else if (isHoliday) className += ' bg-holiday-bg border-holiday-ink/50 text-holiday-ink';
  else if (isExam) className += ' bg-exam-bg border-exam-ink/50 text-exam-ink';
  else if (isSpecialSaturday) className += ' bg-special-bg border-special-ink/50 text-special-ink';
  else if (isPast && !isToday) className += ' border-black/30 bg-transparent text-muted';
  else className += ' bg-cal-cell border-black/60 text-black';

  if (isPast && !isToday && (isHoliday || isExam || isSpecialSaturday)) className += ' opacity-80';

  if (plannedBunks > 0 && !isToday) className += ' !border-2 !border-adjusted bg-adjusted/10 text-adjusted';
  if (isToday) className += ' !border-teal bg-teal font-extrabold text-white';
  const isTodayLink = isToday && !!onTodayClick;
  if (isTappable || isTodayLink) className += ' cursor-pointer hover:-translate-y-px';
  if (isTappable) className += ' hover:border-black';
  if (isExpanded) className += ' !border-adjusted ring-2 ring-adjusted/30';

  const detailKind: 'holiday' | 'exam' | 'special' | null = isHoliday ? 'holiday' : isExam ? 'exam' : isSpecialSaturday ? 'special' : null;
  const dayLabel = dayLabelFormatter.format(new Date(`${iso}T00:00:00Z`));
  const srDetail = [
    `${dayLabel}: ${count} period${count !== 1 ? 's' : ''}`,
    detailKind === 'holiday' ? `Holiday — ${holidayName ?? 'Holiday'}` : null,
    detailKind === 'exam' ? `Exam — ${examName ?? 'Exam'}` : null,
    detailKind === 'special' ? 'Working Saturday' : null,
    plannedBunks > 0 ? `${plannedBunks} planned bunk${plannedBunks === 1 ? '' : 's'}` : null,
    isTappable ? 'Tap to adjust attendance' : null,
    isTodayLink ? 'Today. Tap to go to today’s classes' : null,
  ].filter(Boolean).join('. ');

  const interactive = isTappable || isTodayLink;
  const handleClick = () => {
    if (isTodayLink) onTodayClick?.();
    else if (isTappable && onDayClick) onDayClick(iso);
  };

  return (
    <div
      className={className}
      onClick={handleClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
      aria-haspopup={isTappable ? 'dialog' : undefined}
      aria-current={isToday ? 'date' : undefined}
      aria-label={srDetail}
    >
      <span className="text-[12px] leading-none font-bold">{day}</span>
      {inSemester && isHoliday && count === 0 && <span className="mt-0.5 font-term text-[12px] leading-none opacity-80">Off</span>}
      {inSemester && plannedBunks > 0 && <span className="mt-0.5 font-term text-[12px] leading-none font-bold">−{plannedBunks} p.</span>}
      {inSemester && count > 0 && plannedBunks === 0 && <span title={`${count} periods`} className={`mt-0.5 font-term text-[12px] whitespace-nowrap leading-none ${isToday ? 'font-bold text-white' : 'text-muted'}`}>{count} p.</span>}
      {/* Override indicator dot (white on today's teal cell so it stays visible) */}
      {hasOverrides && plannedBunks === 0 && (
        <span className={`absolute top-[2px] right-[2px] size-[6px] rounded-full ${isToday ? 'bg-white' : 'bg-adjusted'}`} aria-label="Has attendance adjustments" />
      )}
    </div>
  );
}

type DayExpansionProps = {
  iso: string;
  cell: MonthCalendarData['dayCells'][number];
  config: ScheduleConfig;
  todayIso: string;
  overrides?: Map<string, 'attended' | 'bunked'>;
  onOverrideChange: (date: string, sequence: number, status: 'attended' | 'bunked' | null) => void;
  onClose: () => void;
};

/** The day's period controls, as a modal popup (same look as the What's New dialog). */
function DayExpansion({ iso, cell, config, todayIso, overrides, onOverrideChange, onClose }: DayExpansionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const periods = periodsForDate(config, iso);
  const dayLabel = dayLabelFormatter.format(new Date(`${iso}T00:00:00Z`));
  const detailKind: 'holiday' | 'exam' | 'special' | null = cell.isHoliday ? 'holiday' : cell.isExam ? 'exam' : cell.isSpecialSaturday ? 'special' : null;
  const isFuture = iso > todayIso;

  // Build the three-state values map from overrides. No override shows as the
  // Auto chip (the default), so every panel has a visibly selected state.
  const values = new Map<number, ThreeStateValue | boolean>();
  for (const period of periods) {
    const key = `${iso}:${period.sequence}`;
    const override = overrides?.get(key);
    if (override) values.set(period.sequence, override);
  }

  const handleChange = (sequence: number, value: ThreeStateValue | boolean) => {
    const status = value === 'updated' || value === 'auto' ? null : (value as 'attended' | 'bunked');
    onOverrideChange(iso, sequence, status);
  };

  // Whole-day shortcut: write (or clear) an override for every period.
  const statuses = periods.map((period) => overrides?.get(`${iso}:${period.sequence}`) ?? null);
  const wholeDayState: ThreeStateValue | null = statuses.length === 0
    ? null
    : statuses.every((status) => status === 'attended') ? 'attended'
        : statuses.every((status) => status === 'bunked') ? 'bunked'
          : null; // mixed
  const setWholeDay = (value: ThreeStateValue) => {
    const status = value === 'auto' ? null : (value as 'attended' | 'bunked');
    for (const period of periods) onOverrideChange(iso, period.sequence, status);
  };
  // Future days are simpler: you either plan to go (the default, which clears
  // any override) or plan to skip. 'auto' below means "clear", i.e. attend.
  const futureWholeDayState: ThreeStateValue | null = statuses.length === 0
    ? null
    : statuses.every((status) => status !== 'bunked') ? 'auto'
      : statuses.every((status) => status === 'bunked') ? 'bunked'
        : null;
  const wholeDayChips: { label: string; value: ThreeStateValue }[] = isFuture
    ? [
        { label: 'Attend all', value: 'auto' },
        { label: 'Absent', value: 'bunked' },
      ]
    : [
        { label: 'Attended all', value: 'attended' },
        { label: 'Absent', value: 'bunked' },
      ];
  const shownWholeDayState = isFuture ? futureWholeDayState : wholeDayState;
  const futureValues = new Map<number, ThreeStateValue | boolean>();
  for (const period of periods) futureValues.set(period.sequence, overrides?.get(`${iso}:${period.sequence}`) !== 'bunked');

  return (
    <dialog
      ref={dialogRef}
      aria-label={dayLabel}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
      className="m-auto w-[calc(100%-24px)] max-w-[440px] max-h-[85vh] overflow-y-auto border-[3px] border-black bg-paper p-5 shadow-hard backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-pop"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 font-term text-[12px] font-bold text-black">{dayLabel}</p>
        <p className="m-0 font-term text-[12px] leading-[1.3] text-muted">{cell.count} period{cell.count !== 1 ? 's' : ''}</p>
      </div>
      {detailKind === 'holiday' && <p className="mb-2 m-0 font-term text-[12px] font-bold leading-[1.3] text-holiday-ink">{cell.holidayName ?? 'Holiday'}</p>}
      {detailKind === 'exam' && <p className="mb-2 m-0 font-term text-[12px] font-bold leading-[1.3] text-exam-ink">{cell.examName ?? 'Exam'}</p>}
      {detailKind === 'special' && <p className="mb-2 m-0 font-term text-[12px] font-bold leading-[1.3] text-special-ink">Working Saturday</p>}
      {periods.length > 0 && (
        <>
          <div className="mb-1.5 h-px bg-black/10" />
          {!isFuture && <PeriodHelp withoutAuto />}
          {!isFuture && <p className="m-0 mt-1 font-term text-[12px] leading-[1.35] text-muted">Tap a selected button again to undo it.</p>}
          <p className="m-0 mt-3 mb-1 font-term text-[12px] font-black text-black">Whole day</p>
          <div role="group" aria-label="Whole day" className="mb-4 grid w-full max-w-[280px] grid-cols-2 gap-1.5">
            {wholeDayChips.map((chip) => {
              const selected = shownWholeDayState === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setWholeDay(!isFuture && selected ? 'auto' : chip.value)}
                  className={`min-h-[40px] min-w-0 cursor-pointer rounded-full border-2 border-black px-3 text-center font-term text-[12px] font-black transition-all duration-100 ${selected ? 'bg-black text-white' : 'bg-[#f0ece1] text-black hover:bg-black/10'}`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <p className="m-0 mb-1.5 font-term text-[12px] font-black text-black">Each period</p>
          {isFuture ? (
            <PeriodToggles
              periods={periods}
              mode="two-state"
              fillRow
              values={futureValues}
              onChange={(sequence, attending) => onOverrideChange(iso, sequence, attending ? null : 'bunked')}
            />
          ) : (
            <PeriodToggles periods={periods} mode="three-state" hideAuto values={values} onChange={handleChange} />
          )}
        </>
      )}
      <button type="button" onClick={() => dialogRef.current?.close()} className="mt-5 min-h-11 w-full cursor-pointer border-2 border-black bg-lime font-term text-[12px] font-bold text-[#14261c] shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]">Done</button>
    </dialog>
  );
}

export function CalendarLegend() {
  const swatch = 'inline-block size-4 border-2 border-black/40';
  return (
    <div className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] font-bold text-muted">
      <span className="inline-flex items-center gap-1.5"><span className={`${swatch} bg-holiday-bg`} /> Holiday</span>
      <span className="inline-flex items-center gap-1.5"><span className={`${swatch} bg-exam-bg`} /> Exam</span>
      <span className="inline-flex items-center gap-1.5"><span className={`${swatch} bg-special-bg`} /> Working Sat</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[6px] rounded-full bg-adjusted" /> Adjusted</span>
    </div>
  );
}
