import type { MonthCalendarData } from '@/domain/schedule/calendar';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const dayLabelFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * One month's day grid: period count, and colored markers for holidays,
 * exams, and working Saturdays. Shared by the admin's stacked semester view
 * and the public single-month calendar so both always look identical.
 */
export function MonthGrid({ data, showHeading = true }: { data: MonthCalendarData; showHeading?: boolean }) {
  const { year, month, blanks, dayCells } = data;
  return (
    <div className="border-[3px] border-black bg-surface p-5 shadow-hard">
      {showHeading && <div className="mb-3 font-term text-[13px] leading-[1.2] font-extrabold uppercase tracking-[.5px] text-teal">{MONTH_NAMES[month]} {year}</div>}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => <span key={label} className="py-1 text-center font-term text-[9px] font-bold uppercase text-muted">{label}</span>)}
        {Array.from({ length: blanks }).map((_, index) => <span key={`b${index}`} />)}
        {dayCells.map(({ day, iso, count, inSemester, isHoliday, isExam, isSpecialSaturday, isToday, holidayName, examName }) => {
          let className = 'group relative flex h-[38px] flex-col items-center justify-center border-2 text-[12px] transition-transform hover:-translate-y-px';
          if (!inSemester || (count === 0 && !isHoliday && !isExam && !isSpecialSaturday)) className += ' border-transparent bg-transparent text-muted opacity-40';
          else if (isHoliday) className += ' bg-holiday-bg border-black text-holiday-ink';
          else if (isExam) className += ' bg-exam-bg border-black text-exam-ink';
          else if (isSpecialSaturday) className += ' bg-special-bg border-black text-special-ink';
          else className += ' bg-cal-cell border-cal-cell-border text-black';
          if (isToday) className += ' !border-today font-extrabold';

          const dayLabel = dayLabelFormatter.format(new Date(`${iso}T00:00:00Z`));
          // A day can technically fall inside both an exam's date range and a
          // holiday (e.g. a holiday landing mid-exam-week); holiday wins for
          // display, matching the cell's own background color priority above.
          const detailKind: 'holiday' | 'exam' | 'special' | null = isHoliday ? 'holiday' : isExam ? 'exam' : isSpecialSaturday ? 'special' : null;
          const srDetail = [
            `${dayLabel}: ${count} period${count !== 1 ? 's' : ''}`,
            detailKind === 'holiday' ? `Holiday — ${holidayName ?? 'Holiday'}` : null,
            detailKind === 'exam' ? `Exam — ${examName ?? 'Exam'}` : null,
            detailKind === 'special' ? 'Working Saturday' : null,
          ].filter(Boolean).join('. ');

          return (
            <div key={day} className={className}>
              <span className="text-[11px] leading-none font-bold">{day}</span>
              {inSemester && count > 0 && <span className="mt-0.5 font-term text-[9px] leading-none font-bold opacity-70">{count}</span>}
              {detailKind === 'holiday' && <span className="mt-0.5 block size-[5px] rounded-full bg-holiday-ink" />}
              {detailKind === 'exam' && <span className="mt-0.5 block size-[5px] rounded-full bg-exam-ink" />}
              {detailKind === 'special' && <span className="mt-0.5 block size-[5px] rounded-full bg-special-ink" />}
              {inSemester && (
                <>
                  <span className="sr-only">{srDetail}</span>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-[160px] -translate-x-1/2 border-2 border-black bg-paper px-2 py-1.5 text-left opacity-0 shadow-[2px_2px_0_var(--shadow-color)] transition-opacity duration-150 group-hover:opacity-100">
                    <p className="m-0 font-term text-[9px] font-bold uppercase tracking-[.4px] text-black">{dayLabel}</p>
                    <p className="m-0 font-term text-[10px] leading-[1.3] text-muted">{count} period{count !== 1 ? 's' : ''}</p>
                    {detailKind === 'holiday' && <p className="m-0 font-term text-[10px] font-bold leading-[1.3] text-holiday-ink">{holidayName ?? 'Holiday'}</p>}
                    {detailKind === 'exam' && <p className="m-0 font-term text-[10px] font-bold leading-[1.3] text-exam-ink">{examName ?? 'Exam'}</p>}
                    {detailKind === 'special' && <p className="m-0 font-term text-[10px] font-bold leading-[1.3] text-special-ink">Working Saturday</p>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  return (
    <div className="mt-4 flex justify-center gap-4 text-[11px] font-bold text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-holiday-ink" /> Holiday</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-exam-ink" /> Exam</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-special-ink" /> Working Sat</span>
    </div>
  );
}
