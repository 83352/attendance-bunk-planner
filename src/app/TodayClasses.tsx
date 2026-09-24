import type { DatedPeriod } from '@/domain/schedule/types';
import { PeriodToggles, type ThreeStateValue } from './PeriodToggles';

type TodayClassesProps = {
  /** Today's periods from the calendar (calendar.today) */
  periods: DatedPeriod[];
  /** Current IST time as HH:MM string */
  currentIstTime: string;
  /** Map of period sequence -> attending (boolean). True = attending (default). */
  values: Map<number, boolean>;
  /** Called when a period is toggled */
  onChange: (sequence: number, attending: boolean) => void;
};

export function TodayClasses({
  periods,
  currentIstTime,
  values,
  onChange,
}: TodayClassesProps) {
  if (periods.length === 0) return null;

  const completed: DatedPeriod[] = [];
  const upcoming: DatedPeriod[] = [];

  for (const p of periods) {
    // Exam periods (full-day) always go into completed
    if (p.start === '00:00' && p.end === '23:59') {
      completed.push(p);
      continue;
    }

    if (p.start > currentIstTime) {
      upcoming.push(p);
    } else {
      // end <= currentIstTime  OR  start <= currentIstTime < end (ongoing)
      completed.push(p);
    }
  }

  const weekday = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
  }).format(new Date(`${periods[0].date}T00:00:00Z`));

  const summary = `${periods.length} period${periods.length === 1 ? '' : 's'} · ${completed.length} completed, ${upcoming.length} upcoming`;

  // PeriodToggles.onChange passes ThreeStateValue | boolean; in two-state mode
  // it will always be boolean, but the type signature is a union. Cast here.
  const handleToggle = (sequence: number, value: ThreeStateValue | boolean) => {
    onChange(sequence, value as boolean);
  };

  return (
    <div className="border-[3px] border-black bg-paper px-5 pt-[18px] pb-5 shadow-hard phone:px-[17px]">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span className="font-term text-[11px] font-black uppercase tracking-[.55px]">
          Today&apos;s Classes
        </span>
        <span className="font-term text-[11px] font-black uppercase tracking-[.55px] text-muted">
          {weekday}
        </span>
      </div>

      {/* Subtitle */}
      <p className="font-term text-[10px] text-muted">{summary}</p>

      {/* Divider */}
      <div className="mt-3 mb-2 h-px bg-black/10" />

      {/* Completed section */}
      {completed.length > 0 && (
        <div>
          <p className="mb-1.5 font-term text-[10px] font-bold uppercase tracking-[.4px] text-muted">
            Completed
          </p>
          <PeriodToggles
            periods={completed}
            mode="two-state"
            isPast={true}
            values={values}
            onChange={handleToggle}
          />
        </div>
      )}

      {/* Upcoming section */}
      {upcoming.length > 0 && (
        <div className={completed.length > 0 ? 'mt-3' : undefined}>
          <p className="mb-1.5 font-term text-[10px] font-bold uppercase tracking-[.4px] text-muted">
            Upcoming
          </p>
          <PeriodToggles
            periods={upcoming}
            mode="two-state"
            values={values}
            onChange={handleToggle}
          />
        </div>
      )}
    </div>
  );
}
