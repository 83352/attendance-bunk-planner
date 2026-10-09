'use client';

import type { DatedPeriod } from '@/domain/schedule/types';

/**
 * 'updated' is the "nothing chosen" value some callers still pass in and get
 * back (it means *remove my override*). In the UI the same state is the
 * 'auto' chip: no correction, the period is whatever the portal/timetable says.
 */
export type ThreeStateValue = 'updated' | 'auto' | 'attended' | 'bunked';

type PeriodTogglesProps = {
  periods: DatedPeriod[];
  mode: 'three-state' | 'two-state';
  isFuture?: boolean;
  isPast?: boolean;
  /** three-state: map of sequence -> ThreeStateValue. Absent = untagged (nothing highlighted). */
  /** two-state: map of sequence -> boolean (true = attending). */
  values: Map<number, ThreeStateValue | boolean>;
  onChange: (sequence: number, value: ThreeStateValue | boolean) => void;
  ongoingSequence?: number;
  /** two-state only: use two equal columns instead of aligning under the last two of a three-column grid. */
  fillRow?: boolean;
  /** three-state only: drop the Auto chip (nothing selected already means "as the portal has it"). */
  hideAuto?: boolean;
};

function formatTime(t: string) {
  return t.slice(0, 5);
}

/** "13:05" -> { clock: "1:05", meridiem: "PM" } */
function to12Hour(t: string) {
  const [h, m] = formatTime(t).split(':').map(Number);
  return { clock: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`, meridiem: h < 12 ? 'AM' : 'PM' };
}

/** "9:10 – 10:10 AM", or "11:15 AM – 1:00 PM" when the range crosses noon. */
function formatRange12(start: string, end: string) {
  const from = to12Hour(start);
  const to = to12Hour(end);
  return from.meridiem === to.meridiem
    ? `${from.clock} – ${to.clock} ${to.meridiem}`
    : `${from.clock} ${from.meridiem} – ${to.clock} ${to.meridiem}`;
}

function isExamPeriod(period: DatedPeriod) {
  return (
    formatTime(period.start) === '00:00' &&
    formatTime(period.end) === '23:59'
  );
}

const CHIP_BASE = 'min-h-[34px] min-w-0 border-2 px-1 text-center font-term text-[12px] font-bold cursor-pointer transition-all duration-100';
const CHIP_IDLE = 'border-black/30 bg-white text-black hover:border-black hover:bg-black/5';

export function PeriodToggles({
  periods,
  mode,
  isFuture,
  isPast,
  values,
  onChange,
  ongoingSequence,
  fillRow = false,
  hideAuto = false,
}: PeriodTogglesProps) {
  return (
    <div className="grid gap-3 phone:gap-2">
      {periods.map((period) => {
        const seq = period.sequence;
        const exam = isExamPeriod(period);
        const timeLabel = exam
          ? 'Exam period'
          : formatRange12(period.start, period.end);

        const isOngoing = ongoingSequence === seq;

        const Label = (
          <div className="flex shrink-0 items-center gap-2 font-term text-[12px] tabular-nums phone:w-[160px] phone:flex-col phone:items-start phone:justify-center phone:gap-[2px]">
            {!exam && <span className="font-black text-black">Period {seq}<span className="phone:hidden" aria-hidden="true"> ·</span></span>}
            <span className={exam ? 'font-bold text-black' : 'text-muted'}>{timeLabel}</span>
            {isOngoing && (
              <span className="mt-0.5 flex items-center gap-1 text-[12px] font-black tracking-wider text-black">
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75 motion-reduce:animate-none"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-lime border border-black/50"></span>
                </span>
                ONGOING
              </span>
            )}
          </div>
        );

        if (mode === 'three-state') {
          const raw = values.get(seq) as ThreeStateValue | undefined;
          // Callers that treat "no override" as a real state (the calendar
          // panels) pass 'updated' or 'auto'; both light the Auto chip.
          const current: ThreeStateValue | undefined = raw === 'updated' ? 'auto' : raw;
          const allChips: { label: string; value: ThreeStateValue; style: string }[] = [
            { label: 'Auto', value: 'auto', style: 'bg-surface border-black text-black' },
            { label: isFuture ? 'Attend' : 'Attended', value: 'attended', style: 'bg-lime border-black text-[#14261c]' },
            { label: isFuture ? 'Bunk' : 'Bunked', value: 'bunked', style: 'bg-danger-bg border-black text-error' },
          ];
          const chips = hideAuto ? allChips.filter((chip) => chip.value !== 'auto') : allChips;

          return (
            <div key={seq} className="flex flex-col gap-1 phone:flex-row phone:items-center phone:gap-2">
              {Label}
              <div role="group" aria-label={`${exam ? timeLabel : `Period ${seq}, ${timeLabel}`} attendance`} className={`grid w-full max-w-[280px] flex-1 gap-1 ${hideAuto ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {chips.map((chip) => {
                  const selected = current === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        // Re-tapping the active chip clears it (back to untagged / no override).
                        onChange(seq, selected ? 'updated' : chip.value);
                      }}
                      className={`${CHIP_BASE} ${selected ? `shadow-[2px_2px_0_var(--shadow-color)] ${chip.style}` : CHIP_IDLE}`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        /* two-state mode */
        const attending = (values.get(seq) as boolean) ?? true;
        const chips: { label: string; value: boolean; style: string; col: string }[] = [
          { label: isPast ? 'Attended' : 'Attending', value: true, style: 'bg-lime border-black text-[#14261c]', col: fillRow ? '' : 'col-start-2' },
          { label: isPast ? 'Bunked' : 'Bunking', value: false, style: 'bg-danger-bg border-black text-error', col: '' },
        ];

        return (
          <div key={seq} className="flex flex-col gap-1 phone:flex-row phone:items-center phone:gap-2">
            {Label}
            {/* Same 3-column grid as three-state rows, so the buttons line up. */}
            <div role="group" aria-label={`${exam ? timeLabel : `Period ${seq}, ${timeLabel}`} attendance`} className={`grid w-full max-w-[280px] flex-1 gap-1 ${fillRow ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {chips.map((chip) => {
                const selected = attending === chip.value;
                return (
                  <button
                    key={String(chip.value)}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(seq, chip.value)}
                    className={`${CHIP_BASE} ${chip.col} ${selected ? `shadow-[2px_2px_0_var(--shadow-color)] ${chip.style}` : CHIP_IDLE}`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
