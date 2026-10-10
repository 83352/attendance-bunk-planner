'use client';

import type { MonthCalendarData } from '@/domain/schedule/calendar';
import { formatDay } from '@/lib/format-date';
import type { PortalTimetableSession } from '@/lib/portal/campx-client';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];


const ATTENDANCE_DOT = { attended: 'bg-present', bunked: 'bg-amber', absent: 'bg-error' } as const;
const ATTENDANCE_LABEL = { attended: 'Attended every period', bunked: 'Bunked at least one period', absent: 'Absent (every period bunked)' } as const;

type MonthGridProps = {
  data: MonthCalendarData;
  showHeading?: boolean;
  /** The day's real sessions from the portal timetable, keyed by ISO date. Enables tap-to-expand. */
  sessionsByDate?: Map<string, PortalTimetableSession[]>;
  expandedDay?: string | null;
  onDayClick?: (iso: string) => void;
};

/**
 * One month's day grid: period count, and colored markers for holidays,
 * exams, and working Saturdays. Tapping a day shows its real classes.
 */
export function MonthGrid({ data, showHeading = true, sessionsByDate, expandedDay, onDayClick }: MonthGridProps) {
  const { year, month, blanks, dayCells } = data;

  const rows: (typeof dayCells[number] | null)[][] = [];
  const paddedCells: (typeof dayCells[number] | null)[] = [...Array.from({ length: blanks }, () => null), ...dayCells];
  for (let i = 0; i < paddedCells.length; i += 7) rows.push(paddedCells.slice(i, i + 7));

  return (
    <div className="rounded-[var(--ui-radius-sm)] border border-edge bg-surface p-3 phone:p-4">
      {showHeading && <div className="mb-3 font-term text-[13px] leading-[1.2] font-extrabold uppercase tracking-[.5px] text-teal">{MONTH_NAMES[month]} {year}</div>}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => <span key={label} className="py-1 text-center font-term text-[11px] font-bold uppercase text-muted">{label}</span>)}
      </div>
      {rows.map((row, rowIndex) => {
        const expandedCell = row.find((cell) => cell && cell.iso === expandedDay);
        return (
          <div key={rowIndex}>
            <div className="grid grid-cols-7 gap-1">
              {row.map((cell, colIndex) =>
                cell ? (
                  <DayCell
                    key={cell.day}
                    cell={cell}
                    isExpanded={cell.iso === expandedDay}
                    isTappable={!!onDayClick && cell.inSemester && (cell.count > 0 || (sessionsByDate?.get(cell.iso)?.length ?? 0) > 0)}
                    onDayClick={onDayClick}
                  />
                ) : (
                  <span key={`b${rowIndex}-${colIndex}`} />
                ),
              )}
            </div>
            {expandedCell && <DayExpansion cell={expandedCell} sessions={sessionsByDate?.get(expandedCell.iso) ?? []} />}
          </div>
        );
      })}
    </div>
  );
}

type DayCellProps = {
  cell: MonthCalendarData['dayCells'][number];
  isExpanded: boolean;
  isTappable: boolean;
  onDayClick?: (iso: string) => void;
};

function DayCell({ cell, isExpanded, isTappable, onDayClick }: DayCellProps) {
  const { day, iso, count, inSemester, isHoliday, isExam, isSpecialSaturday, isToday, holidayName, examName, attendance } = cell;

  let className = 'relative flex h-[40px] flex-col items-center justify-center rounded-[var(--ui-radius-sm)] border-[length:var(--ui-border-sm)] text-[12px] transition-transform';
  if (!inSemester || (count === 0 && !isHoliday && !isExam && !isSpecialSaturday)) className += ' border-transparent bg-transparent text-muted opacity-40';
  else if (isHoliday) className += ' bg-holiday-bg border-edge text-holiday-ink';
  else if (isExam) className += ' bg-exam-bg border-edge text-exam-ink';
  else if (isSpecialSaturday) className += ' bg-special-bg border-edge text-special-ink';
  else className += ' bg-cal-cell border-cal-cell-border text-black';
  if (isToday) className += ' !border-today font-extrabold';
  if (isTappable) className += ' cursor-pointer hover:-translate-y-px';
  if (isExpanded) className += ' !border-orange ring-2 ring-orange/30';

  const detailKind: 'holiday' | 'exam' | 'special' | null = isHoliday ? 'holiday' : isExam ? 'exam' : isSpecialSaturday ? 'special' : null;
  const srDetail = [
    `${formatDay(iso)}: ${count} period${count !== 1 ? 's' : ''}`,
    detailKind === 'holiday' ? `Holiday — ${holidayName ?? 'Holiday'}` : null,
    detailKind === 'exam' ? `Exam — ${examName ?? 'Exam'}` : null,
    detailKind === 'special' ? 'Working Saturday' : null,
    attendance ? ATTENDANCE_LABEL[attendance] : null,
    isTappable ? 'Tap to see the classes' : null,
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
      onKeyDown={isTappable ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleClick(); } } : undefined}
      aria-expanded={isTappable ? isExpanded : undefined}
      aria-label={srDetail}
    >
      <span className="text-[13px] leading-none font-bold">{day}</span>
      {inSemester && count > 0 && <span className="mt-0.5 font-term text-[11px] leading-none font-bold opacity-70">{count}</span>}
      {detailKind === 'holiday' && <span className="mt-0.5 block size-[5px] rounded-full bg-holiday-ink" />}
      {detailKind === 'exam' && <span className="mt-0.5 block size-[5px] rounded-full bg-exam-ink" />}
      {detailKind === 'special' && <span className="mt-0.5 block size-[5px] rounded-full bg-special-ink" />}
      {attendance && <span className={`absolute top-[3px] right-[3px] size-[7px] rounded-full ${ATTENDANCE_DOT[attendance]}`} />}
    </div>
  );
}

function sessionStatus(session: PortalTimetableSession): { label: string; className: string } {
  if (session.isSuspended) return { label: 'Suspended', className: 'border-edge text-muted' };
  if (session.attended === true) return { label: 'Attended', className: 'border-present bg-present-bg text-present' };
  if (session.attended === false) return { label: 'Bunked', className: 'border-error bg-danger-bg text-error' };
  return { label: session.synthetic ? 'Not on portal yet' : 'Not marked yet', className: 'border-edge text-muted' };
}

/** The tapped day's real timetable rows, straight from the portal. */
function DayExpansion({ cell, sessions }: { cell: MonthCalendarData['dayCells'][number]; sessions: PortalTimetableSession[] }) {
  const dayLabel = formatDay(cell.iso);
  return (
    <div className="my-1.5 rounded-[var(--ui-radius-sm)] border border-edge bg-paper p-3 shadow-[var(--shadow-hard-sm)] [animation:var(--animate-calendar-pop)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 font-term text-[12px] font-bold uppercase tracking-[.4px] text-black">{dayLabel}</p>
        <p className="m-0 font-term text-[12px] leading-[1.3] text-muted">{cell.count} period{cell.count !== 1 ? 's' : ''}</p>
      </div>
      {cell.isHoliday && <p className="m-0 mb-2 font-term text-[12px] font-bold text-holiday-ink">{cell.holidayName ?? 'Holiday'}</p>}
      {cell.isExam && <p className="m-0 mb-2 font-term text-[12px] font-bold text-exam-ink">{cell.examName ?? 'Exam'}</p>}
      {cell.isSpecialSaturday && <p className="m-0 mb-2 font-term text-[12px] font-bold text-special-ink">Working Saturday</p>}
      <div className="grid gap-1">
        {sessions.map((session, index) => {
          const status = sessionStatus(session);
          return (
            <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-edge/60 pt-1.5 font-term text-[13px]">
              <span>
                <span className="font-bold">{session.fromTime.slice(0, 5)}</span> · {session.subjectName}
                {session.periods.length > 1 ? ` (${session.periods.length} periods)` : ''}
                {session.groupName ? ` · ${session.groupName}` : ''}
              </span>
              <span className={`rounded-full border px-2 py-px text-[12px] font-bold ${status.className}`}>{status.label}</span>
            </div>
          );
        })}
        {sessions.length === 0 && <p className="m-0 font-term text-[13px] text-muted">No classes on the portal for this day.</p>}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  const item = 'inline-flex items-center gap-1.5';
  return (
    <div className="mt-4 grid gap-2 font-term text-[12px] font-bold text-muted">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        <span className={item}><span className="inline-block size-[7px] rounded-full bg-present" /> Attended</span>
        <span className={item}><span className="inline-block size-[7px] rounded-full bg-amber" /> Bunked a period</span>
        <span className={item}><span className="inline-block size-[7px] rounded-full bg-error" /> Absent (all periods)</span>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        <span className={item}><span className="inline-block size-[7px] rounded-full bg-holiday-ink" /> Holiday</span>
        <span className={item}><span className="inline-block size-[7px] rounded-full bg-exam-ink" /> Exam</span>
        <span className={item}><span className="inline-block size-[7px] rounded-full bg-special-ink" /> Working Saturday</span>
      </div>
      <p className="m-0 text-center font-normal">The number under a date is how many periods that day has.</p>
    </div>
  );
}
