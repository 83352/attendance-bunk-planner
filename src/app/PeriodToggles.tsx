'use client';

import type { DatedPeriod } from '@/domain/schedule/types';

export type ThreeStateValue = 'updated' | 'attended' | 'bunked';

type PeriodTogglesProps = {
  periods: DatedPeriod[];
  mode: 'three-state' | 'two-state';
  isFuture?: boolean;
  /** three-state: map of sequence -> ThreeStateValue. Absent = 'updated'. */
  /** two-state: map of sequence -> boolean (true = attending). */
  values: Map<number, ThreeStateValue | boolean>;
  onChange: (sequence: number, value: ThreeStateValue | boolean) => void;
};

function formatTime(t: string) {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

function isExamPeriod(period: DatedPeriod) {
  return (
    period.start.startsWith('00:00') &&
    period.end.startsWith('23:59')
  );
}

export function PeriodToggles({
  periods,
  mode,
  isFuture,
  values,
  onChange,
}: PeriodTogglesProps) {
  return (
    <div className="grid gap-1.5">
      {periods.map((period) => {
        const seq = period.sequence;
        const exam = isExamPeriod(period);
        const timeLabel = exam
          ? 'Exam period'
          : `${formatTime(period.start)} – ${formatTime(period.end)}`;

        if (mode === 'three-state') {
          const current = (values.get(seq) as ThreeStateValue) ?? 'updated';
          const chips: { label: string; value: ThreeStateValue; style: string }[] = [
            {
              label: isFuture ? 'Auto' : 'Updated',
              value: 'updated',
              style: 'bg-surface border-black',
            },
            {
              label: isFuture ? 'Attend' : 'Attended',
              value: 'attended',
              style: 'bg-lime border-black text-[#14261c]',
            },
            {
              label: isFuture ? 'Bunk' : 'Bunked',
              value: 'bunked',
              style: 'bg-danger-bg border-black text-error',
            },
          ];

          return (
            <div key={seq} className="flex items-center justify-between">
              <div className="font-term text-[10px] uppercase tracking-[.4px] opacity-60">
                <span className="font-bold">Period {seq}</span>
                <span className="ml-1.5">{timeLabel}</span>
              </div>
              <div className="flex gap-1">
                {chips.map((chip) => {
                  const selected = current === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onChange(seq, chip.value)}
                      className={[
                        'px-2.5 py-1 font-term text-[10px] uppercase tracking-[.4px] cursor-pointer transition-all duration-100',
                        chip.style,
                        selected
                          ? 'border-2 border-black font-bold shadow-[2px_2px_0_var(--shadow-color)]'
                          : 'border border-black/20 opacity-50',
                      ].join(' ')}
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
        const chips: { label: string; value: boolean; style: string }[] = [
          {
            label: isFuture === false ? 'Attended' : 'Attending',
            value: true,
            style: 'bg-lime border-black text-[#14261c]',
          },
          {
            label: isFuture === false ? 'Bunked' : 'Bunking',
            value: false,
            style: 'bg-danger-bg border-black text-error',
          },
        ];

        return (
          <div key={seq} className="flex items-center justify-between">
            <div className="font-term text-[10px] uppercase tracking-[.4px] opacity-60">
              <span className="font-bold">Period {seq}</span>
              <span className="ml-1.5">{timeLabel}</span>
            </div>
            <div className="flex gap-1">
              {chips.map((chip) => {
                const selected = attending === chip.value;
                return (
                  <button
                    key={String(chip.value)}
                    type="button"
                    onClick={() => onChange(seq, chip.value)}
                    className={[
                      'px-2.5 py-1 font-term text-[10px] uppercase tracking-[.4px] cursor-pointer transition-all duration-100',
                      chip.style,
                      selected
                        ? 'border-2 border-black font-bold shadow-[2px_2px_0_var(--shadow-color)]'
                        : 'border border-black/20 opacity-50',
                    ].join(' ')}
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
