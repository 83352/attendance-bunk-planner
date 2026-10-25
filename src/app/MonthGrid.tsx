'use client';

import { currentIstDate, type MonthCalendarData } from '@/domain/schedule/calendar';
import { formatDay } from '@/lib/format-date';
import type { PortalTimetableSession } from '@/lib/portal/campx-client';
import { answerKey, type Answer } from '@/lib/portal/saved-answers';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];


/**
 * Attendance is coded by shape as well as colour (so it reads without colour
 * vision, and in sunlight): tick = attended, half circle = bunked a period,
 * cross = absent all day. Day types get a letter: H holiday, E exam, W working Saturday.
 */
function AttendanceMark({ kind, className = '' }: { kind: 'attended' | 'bunked' | 'absent'; className?: string }) {
  if (kind === 'bunked') {
    return <span aria-hidden="true" className={`inline-block size-[9px] rounded-full border-2 border-amber bg-[linear-gradient(90deg,var(--color-amber)_50%,transparent_50%)] ${className}`} />;
  }
  return (
    <span aria-hidden="true" className={`font-term text-[12px] leading-none font-extrabold ${kind === 'attended' ? 'text-present' : 'text-error'} ${className}`}>
      {kind === 'attended' ? '✓' : '✕'}
    </span>
  );
}

function DayTypeMark({ letter, className }: { letter: 'H' | 'E' | 'W'; className: string }) {
  return <span aria-hidden="true" className={`font-term text-[9px] leading-none font-extrabold ${className}`}>{letter}</span>;
}
const ATTENDANCE_LABEL = { attended: 'Attended every period', bunked: 'Bunked at least one period', absent: 'Absent (every period bunked)' } as const;

type MonthGridProps = {
  data: MonthCalendarData;
  showHeading?: boolean;
  /** The day's real sessions from the portal timetable, keyed by ISO date. Enables tap-to-expand. */
  sessionsByDate?: Map<string, PortalTimetableSession[]>;
  expandedDay?: string | null;
  onDayClick?: (iso: string) => void;
  /** Periods the student can answer from the tapped day (keys from answerKey), and the handler. */
  answerableKeys?: ReadonlySet<string>;
  onAnswer?: (session: PortalTimetableSession, answer: Answer) => void;
};

/**
 * One month's day grid: period count, and colored markers for holidays,
 * exams, and working Saturdays. Tapping a day shows its real classes.
 */
export function MonthGrid({ data, showHeading = true, sessionsByDate, expandedDay, onDayClick, answerableKeys, onAnswer }: MonthGridProps) {
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
      <div className="mt-1 grid gap-1">
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
                    isTappable={!!onDayClick && cell.inSemester && (cell.count > 0 || cell.isHoliday || (sessionsByDate?.get(cell.iso)?.length ?? 0) > 0)}
                    onDayClick={onDayClick}
                  />
                ) : (
                  <span key={`b${rowIndex}-${colIndex}`} />
                ),
              )}
            </div>
            {expandedCell && <DayExpansion cell={expandedCell} sessions={sessionsByDate?.get(expandedCell.iso) ?? []} answerableKeys={answerableKeys} onAnswer={onAnswer} />}
          </div>
        );
      })}
      </div>
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
  const { day, iso, count, inSemester, isHoliday, isExam, isSpecialSaturday, isToday, holidayName, examName, attendance, needsAnswer } = cell;

  let className = 'relative flex h-[44px] flex-col items-center justify-center rounded-[var(--ui-radius-sm)] border-[length:var(--ui-border-sm)] text-[12px] transition-[transform,border-color,box-shadow] duration-150';
  if (!inSemester || (count === 0 && !isHoliday && !isExam && !isSpecialSaturday)) className += ' border-transparent bg-transparent text-muted opacity-40';
  else if (isHoliday) className += ' bg-holiday-bg border-edge text-holiday-ink';
  else if (isExam) className += ' bg-exam-bg border-edge text-exam-ink';
  else if (isSpecialSaturday) className += ' bg-special-bg border-edge text-special-ink';
  else className += ' bg-cal-cell border-cal-cell-border text-black';
  if (needsAnswer) className += ' !border-dashed !border-amber';
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
    needsAnswer ? 'A period is waiting for your answer' : null,
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
      {detailKind === 'holiday' && <DayTypeMark letter="H" className="absolute bottom-[2px] left-[3px] text-holiday-ink" />}
      {detailKind === 'exam' && <DayTypeMark letter="E" className="absolute bottom-[2px] left-[3px] text-exam-ink" />}
      {detailKind === 'special' && <DayTypeMark letter="W" className="absolute bottom-[2px] left-[3px] text-special-ink" />}
      {needsAnswer && <span aria-hidden="true" className="absolute top-[1px] right-[3px] font-term text-[12px] leading-none font-bold text-bunked-ink">?</span>}
      {attendance && <AttendanceMark kind={attendance} className="absolute top-[2px] right-[3px]" />}
    </div>
  );
}

/** "Upcoming" (hasn't happened) and "Not marked yet" (happened, portal hasn't marked it) are different states, so they get different labels. */
function sessionStatus(session: PortalTimetableSession, todayIso: string): { label: string; className: string } {
  if (session.isSuspended) return { label: 'Suspended', className: 'border-edge text-muted' };
  if (session.attended === true) return { label: '✓ Attended', className: 'border-present bg-present-bg text-present' };
  if (session.attended === false) return { label: '✕ Bunked', className: 'border-amber bg-bunked-bg text-bunked-ink' };
  if (session.date >= todayIso) return { label: session.synthetic ? 'Upcoming · not on portal yet' : 'Upcoming', className: 'border-dashed border-edge text-muted' };
  return { label: session.synthetic ? 'Not on portal yet' : 'Not marked yet', className: 'border-edge text-muted' };
}

/** The tapped day's real timetable rows, straight from the portal. */
function DayExpansion({ cell, sessions, answerableKeys, onAnswer }: { cell: MonthCalendarData['dayCells'][number]; sessions: PortalTimetableSession[]; answerableKeys?: ReadonlySet<string>; onAnswer?: (session: PortalTimetableSession, answer: Answer) => void }) {
  const dayLabel = formatDay(cell.iso);
  const todayIso = currentIstDate(new Date());
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
          const status = sessionStatus(session, todayIso);
          const answerable = !!onAnswer && !!answerableKeys?.has(answerKey(session));
          return (
            <div key={index} className="grid gap-1.5 border-t border-edge/60 pt-1.5 font-term text-[13px]">
              {/* Fixed status column, so chips line up down the list whatever the subject name's length. */}
              <div className="grid grid-cols-[1fr_auto] items-start gap-x-3">
                <span>
                  <span className="font-bold">{session.fromTime.slice(0, 5)}</span> · {session.subjectName}
                  {session.periods.length > 1 ? ` (${session.periods.length} periods)` : ''}
                  {session.groupName ? ` · ${session.groupName}` : ''}
                </span>
                {!answerable && <span className={`whitespace-nowrap rounded-full border px-2 py-px text-[12px] font-bold ${status.className}`}>{status.label}</span>}
              </div>
              {answerable && (
                <div role="group" aria-label={`Did you attend ${session.subjectName}?`} className="grid grid-cols-2 gap-1.5">
                  <span className="col-span-2 text-[12px] text-muted">The portal hasn&rsquo;t marked this yet. Did you attend?</span>
                  <button type="button" aria-pressed={session.attended === true} onClick={() => onAnswer(session, 'attended')} className={`chip whitespace-nowrap ${session.attended === true ? '!border-present !bg-present-bg !text-present' : ''}`}>
                    {session.attended === true ? '✓ ' : ''}Attended
                  </button>
                  <button type="button" aria-pressed={session.attended === false} onClick={() => onAnswer(session, 'bunked')} className={`chip whitespace-nowrap ${session.attended === false ? '!border-amber !bg-bunked-bg !text-bunked-ink' : ''}`}>
                    {session.attended === false ? '✕ ' : ''}Bunked
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && <p className="m-0 font-term text-[13px] text-muted">{cell.isHoliday ? 'No classes: holiday.' : 'No classes on the portal for this day.'}</p>}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  const item = 'inline-flex items-center gap-1.5';
  const tile = 'inline-grid size-[16px] place-items-center rounded-[3px] border border-edge font-term text-[9px] leading-none font-extrabold';
  return (
    <div className="mt-4 grid gap-2 font-term text-[13px] font-bold text-muted">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        <span className={item}><AttendanceMark kind="attended" /> Attended</span>
        <span className={item}><AttendanceMark kind="bunked" /> Bunked a period</span>
        <span className={item}><AttendanceMark kind="absent" /> Absent all day</span>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        <span className={item}><span aria-hidden="true" className={`${tile} bg-holiday-bg text-holiday-ink`}>H</span> Holiday</span>
        <span className={item}><span aria-hidden="true" className={`${tile} bg-exam-bg text-exam-ink`}>E</span> Exam</span>
        <span className={item}><span aria-hidden="true" className={`${tile} bg-special-bg text-special-ink`}>W</span> Working Saturday</span>
        <span className={item}><span aria-hidden="true" className="inline-grid size-[16px] place-items-center rounded-[3px] border border-dashed border-amber text-[11px] leading-none text-bunked-ink">?</span> Needs your answer</span>
      </div>
    </div>
  );
}
