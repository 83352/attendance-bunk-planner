'use client';

import { periodsForDate, type MonthCalendarData } from '@/domain/schedule/calendar';
import type { ScheduleConfig } from '@/domain/schedule/types';
import { PeriodToggles, type ThreeStateValue } from './PeriodToggles';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const dayLabelFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

type MonthGridProps = {
  data: MonthCalendarData;
  showHeading?: boolean;
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
  expandedDay,
  onDayClick,
  overrides,
  onOverrideChange,
  todayIso,
  config,
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

  return (
    <div className="border-[3px] border-black bg-surface p-5 shadow-hard">
      {showHeading && <div className="mb-3 font-term text-[13px] leading-[1.2] font-extrabold uppercase tracking-[.5px] text-teal">{MONTH_NAMES[month]} {year}</div>}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => <span key={label} className="py-1 text-center font-term text-[9px] font-bold uppercase text-muted">{label}</span>)}
      </div>
      {rows.map((row, rowIndex) => {
        // Check if any cell in this row is the currently expanded day.
        const expandedInRow = row.find((cell) => cell && cell.iso === expandedDay);
        return (
          <div key={rowIndex}>
            <div className="grid grid-cols-7 gap-1">
              {row.map((cell, colIndex) => {
                if (!cell) return <span key={`b${rowIndex}-${colIndex}`} />;
                return (
                  <DayCell
                    key={cell.day}
                    cell={cell}
                    isExpanded={cell.iso === expandedDay}
                    isTappable={!!onDayClick && !!todayIso && cell.inSemester && cell.iso !== todayIso && cell.count > 0}
                    hasOverrides={overrides ? hasOverridesForDate(overrides, cell.iso) : false}
                    onDayClick={onDayClick}
                  />
                );
              })}
            </div>
            {expandedInRow && config && onOverrideChange && todayIso && (
              <DayExpansion
                iso={expandedInRow.iso}
                cell={expandedInRow}
                config={config}
                todayIso={todayIso}
                overrides={overrides}
                onOverrideChange={onOverrideChange}
              />
            )}
          </div>
        );
      })}
    </div>
  );
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
  onDayClick?: (iso: string) => void;
};

function DayCell({ cell, isExpanded, isTappable, hasOverrides, onDayClick }: DayCellProps) {
  const { day, iso, count, inSemester, isHoliday, isExam, isSpecialSaturday, isToday, holidayName, examName } = cell;

  let className = 'relative flex h-[38px] flex-col items-center justify-center border-2 text-[12px] transition-transform';
  if (!inSemester || (count === 0 && !isHoliday && !isExam && !isSpecialSaturday)) className += ' border-transparent bg-transparent text-muted opacity-40';
  else if (isHoliday) className += ' bg-holiday-bg border-black text-holiday-ink';
  else if (isExam) className += ' bg-exam-bg border-black text-exam-ink';
  else if (isSpecialSaturday) className += ' bg-special-bg border-black text-special-ink';
  else className += ' bg-cal-cell border-cal-cell-border text-black';
  if (isToday) className += ' !border-today font-extrabold';
  if (isTappable) className += ' cursor-pointer hover:-translate-y-px';
  if (isExpanded) className += ' !border-orange ring-2 ring-orange/30';

  const detailKind: 'holiday' | 'exam' | 'special' | null = isHoliday ? 'holiday' : isExam ? 'exam' : isSpecialSaturday ? 'special' : null;
  const dayLabel = dayLabelFormatter.format(new Date(`${iso}T00:00:00Z`));
  const srDetail = [
    `${dayLabel}: ${count} period${count !== 1 ? 's' : ''}`,
    detailKind === 'holiday' ? `Holiday — ${holidayName ?? 'Holiday'}` : null,
    detailKind === 'exam' ? `Exam — ${examName ?? 'Exam'}` : null,
    detailKind === 'special' ? 'Working Saturday' : null,
    isTappable ? 'Tap to adjust attendance' : null,
  ].filter(Boolean).join('. ');

  const handleClick = () => {
    if (isTappable && onDayClick) onDayClick(iso);
  };

  return (
    <div
      className={className}
      onClick={handleClick}
      role={isTappable ? 'button' : undefined}
      tabIndex={isTappable ? 0 : undefined}
      onKeyDown={isTappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
      aria-expanded={isTappable ? isExpanded : undefined}
      aria-label={srDetail}
    >
      <span className="text-[11px] leading-none font-bold">{day}</span>
      {inSemester && count > 0 && <span className="mt-0.5 font-term text-[9px] leading-none font-bold opacity-70">{count}</span>}
      {detailKind === 'holiday' && <span className="mt-0.5 block size-[5px] rounded-full bg-holiday-ink" />}
      {detailKind === 'exam' && <span className="mt-0.5 block size-[5px] rounded-full bg-exam-ink" />}
      {detailKind === 'special' && <span className="mt-0.5 block size-[5px] rounded-full bg-special-ink" />}
      {/* Orange override indicator dot */}
      {hasOverrides && (
        <span className="absolute top-[2px] right-[2px] size-[6px] rounded-full bg-orange" aria-label="Has attendance adjustments" />
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
};

function DayExpansion({ iso, cell, config, todayIso, overrides, onOverrideChange }: DayExpansionProps) {
  const periods = periodsForDate(config, iso);
  const dayLabel = dayLabelFormatter.format(new Date(`${iso}T00:00:00Z`));
  const detailKind: 'holiday' | 'exam' | 'special' | null = cell.isHoliday ? 'holiday' : cell.isExam ? 'exam' : cell.isSpecialSaturday ? 'special' : null;
  const isFuture = iso > todayIso;

  // Build the three-state values map from overrides.
  const values = new Map<number, ThreeStateValue | boolean>();
  for (const period of periods) {
    const key = `${iso}:${period.sequence}`;
    const override = overrides?.get(key);
    values.set(period.sequence, override ?? 'updated');
  }

  const handleChange = (sequence: number, value: ThreeStateValue | boolean) => {
    const status = value === 'updated' ? null : (value as 'attended' | 'bunked');
    onOverrideChange(iso, sequence, status);
  };

  return (
    <div className="col-span-7 mt-1 mb-1 border-2 border-black bg-paper p-3 shadow-[2px_2px_0_var(--shadow-color)] [animation:var(--animate-calendar-pop)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 font-term text-[10px] font-bold uppercase tracking-[.4px] text-black">{dayLabel}</p>
        <p className="m-0 font-term text-[10px] leading-[1.3] text-muted">{cell.count} period{cell.count !== 1 ? 's' : ''}</p>
      </div>
      {detailKind === 'holiday' && <p className="mb-2 m-0 font-term text-[10px] font-bold leading-[1.3] text-holiday-ink">{cell.holidayName ?? 'Holiday'}</p>}
      {detailKind === 'exam' && <p className="mb-2 m-0 font-term text-[10px] font-bold leading-[1.3] text-exam-ink">{cell.examName ?? 'Exam'}</p>}
      {detailKind === 'special' && <p className="mb-2 m-0 font-term text-[10px] font-bold leading-[1.3] text-special-ink">Working Saturday</p>}
      {periods.length > 0 && (
        <>
          <div className="mb-1.5 h-px bg-black/10" />
          <p className="mb-1.5 font-term text-[9px] uppercase tracking-[.4px] font-bold text-muted">
            {isFuture ? 'Plan specific bunks/attendance' : 'Mark periods not updated by teacher'}
          </p>
          <PeriodToggles periods={periods} mode="three-state" isFuture={isFuture} values={values} onChange={handleChange} />
        </>
      )}
    </div>
  );
}

export function CalendarLegend({ hasOverrides }: { hasOverrides?: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4 text-[11px] font-bold text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-holiday-ink" /> Holiday</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-exam-ink" /> Exam</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-special-ink" /> Working Sat</span>
      {hasOverrides && <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[6px] rounded-full bg-orange" /> Adjusted</span>}
    </div>
  );
}
