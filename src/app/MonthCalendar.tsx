'use client';

import { useState } from 'react';
import { currentIstDate, monthCalendarData } from '@/domain/schedule/calendar';
import type { ScheduleConfig } from '@/domain/schedule/types';
import { CalendarLegend, MONTH_NAMES, MonthGrid } from './MonthGrid';

/** Encodes a year+month pair as one comparable integer for clamping/stepping. */
function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Single-month calendar for the public calculator: shows the current month
 * (highlighting today) with Prev/Next arrows clamped to the section's own
 * semester range, so every month a student can reach actually has data.
 */
export function MonthCalendar({ config }: { config: ScheduleConfig }) {
  const startDate = new Date(`${config.semesterStart}T00:00:00Z`);
  const endDate = new Date(`${config.semesterEnd}T00:00:00Z`);
  const startKey = monthKey(startDate.getUTCFullYear(), startDate.getUTCMonth());
  const endKey = monthKey(endDate.getUTCFullYear(), endDate.getUTCMonth());

  const todayIso = currentIstDate(new Date());
  const today = new Date(`${todayIso}T00:00:00Z`);
  const initialKey = clamp(monthKey(today.getUTCFullYear(), today.getUTCMonth()), startKey, endKey);

  const [viewKey, setViewKey] = useState(initialKey);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const clampedKey = clamp(viewKey, startKey, endKey);
  const viewYear = Math.floor(clampedKey / 12);
  const viewMonth = ((clampedKey % 12) + 12) % 12;

  const data = monthCalendarData(config, viewYear, viewMonth, todayIso);
  const atStart = clampedKey <= startKey;
  const atEnd = clampedKey >= endKey;
  const animateClass = direction === 'next' ? 'animate-month-in-next' : 'animate-month-in-prev';

  const goTo = (nextKey: number, dir: 'next' | 'prev') => { setDirection(dir); setViewKey(nextKey); };

  return (
    <div className="mb-[clamp(17px,2vw,22px)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="eyebrow-text mb-[3px] text-[10px] text-teal">Semester overview</p><h2 key={clampedKey} className={`m-0 font-display text-[20px] leading-none font-black uppercase ${animateClass}`}>{MONTH_NAMES[viewMonth]} {viewYear}</h2></div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => goTo(clampedKey - 1, 'prev')} disabled={atStart} className="size-9 cursor-pointer border-2 border-black bg-surface text-[16px] font-bold text-black shadow-[2px_2px_0_var(--shadow-color)] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous month">‹</button>
          <button type="button" onClick={() => goTo(clampedKey + 1, 'next')} disabled={atEnd} className="size-9 cursor-pointer border-2 border-black bg-surface text-[16px] font-bold text-black shadow-[2px_2px_0_var(--shadow-color)] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next month">›</button>
        </div>
      </div>
      <div key={clampedKey} className={animateClass}>
        <MonthGrid data={data} showHeading={false} />
      </div>
      <CalendarLegend />
    </div>
  );
}
