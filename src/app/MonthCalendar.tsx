'use client';

import { useMemo, useState } from 'react';
import { currentIstDate } from '@/domain/schedule/calendar';
import type { CalendarOverrides } from '@/lib/portal/calendar-overrides';
import type { PortalTimetableSession } from '@/lib/portal/campx-client';
import { portalMonthData, semesterBounds } from '@/lib/portal/month-data';
import { CalendarLegend, MONTH_NAMES, MonthGrid } from './MonthGrid';

/** Encodes a year+month pair as one comparable integer for clamping/stepping. */
function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Single-month semester calendar, built from the synced portal timetable
 * (with the manual calendar's holidays/exams/special Saturdays on top).
 * Shows the current month, highlighting today, with Prev/Next arrows clamped
 * to the semester's range.
 */
export function MonthCalendar({ timetable, overrides }: { timetable: PortalTimetableSession[]; overrides: CalendarOverrides | null }) {
  const bounds = semesterBounds(timetable, overrides);
  const todayIso = currentIstDate(new Date());
  const [viewKey, setViewKey] = useState<number | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, PortalTimetableSession[]>();
    for (const session of timetable) map.set(session.date, [...(map.get(session.date) ?? []), session]);
    return map;
  }, [timetable]);
  if (!bounds) return null;

  const startDate = new Date(`${bounds.start}T00:00:00Z`);
  const endDate = new Date(`${bounds.end}T00:00:00Z`);
  const startKey = monthKey(startDate.getUTCFullYear(), startDate.getUTCMonth());
  const endKey = monthKey(endDate.getUTCFullYear(), endDate.getUTCMonth());
  const today = new Date(`${todayIso}T00:00:00Z`);
  const clampedKey = clamp(viewKey ?? monthKey(today.getUTCFullYear(), today.getUTCMonth()), startKey, endKey);
  const viewYear = Math.floor(clampedKey / 12);
  const viewMonth = ((clampedKey % 12) + 12) % 12;

  const data = portalMonthData(timetable, overrides, bounds, viewYear, viewMonth, todayIso);
  const animateClass = direction === 'next' ? 'animate-month-in-next' : 'animate-month-in-prev';
  const goTo = (nextKey: number, dir: 'next' | 'prev') => {
    setDirection(dir);
    setViewKey(nextKey);
    setExpandedDay(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow-text mb-[3px] text-[10px] text-teal">Semester overview</p>
          <h2 key={clampedKey} className={`m-0 heading text-[20px] leading-none ${animateClass}`}>{MONTH_NAMES[viewMonth]} {viewYear}</h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => goTo(clampedKey - 1, 'prev')} disabled={clampedKey <= startKey} className="chip !px-0 text-[16px]" aria-label="Previous month">‹</button>
          <button type="button" onClick={() => goTo(clampedKey + 1, 'next')} disabled={clampedKey >= endKey} className="chip !px-0 text-[16px]" aria-label="Next month">›</button>
        </div>
      </div>
      <div key={clampedKey} className={animateClass}>
        <MonthGrid
          data={data}
          showHeading={false}
          sessionsByDate={sessionsByDate}
          expandedDay={expandedDay}
          onDayClick={(iso) => setExpandedDay((prev) => (prev === iso ? null : iso))}
        />
      </div>
      <CalendarLegend />
      <p className="mt-2 text-center font-term text-[9px] uppercase tracking-[.4px] text-muted">Tap a day to see its classes and your attendance.</p>
    </div>
  );
}
