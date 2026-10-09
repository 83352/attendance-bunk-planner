'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateAttendance } from '@/domain/attendance/engine';
import type { AttendanceAdjustments, AttendanceResult } from '@/domain/attendance/types';
import { buildCalendar, currentIstDate } from '@/domain/schedule/calendar';
import type { DatedPeriod, ScheduleConfig } from '@/domain/schedule/types';
import { SECTION_COOKIE, SECTION_PICKED_EVENT } from '@/lib/section-cookie';
import { clearAdjustments, loadAdjustments, saveAdjustments } from '@/lib/period-storage';
import { prefersReducedMotion } from '@/lib/motion';
import { MonthCalendar } from './MonthCalendar';
import { Results, resultAnnouncement } from './Results';
import { SectionSelector, type SectionOption } from './SectionSelector';
import { SiteHeader } from './SiteHeader';
import { TodayClasses } from './TodayClasses';

/** An attended-period count shown exactly: the entered % is applied to periods held, so it can be fractional. */
const exactCount = (value: number) => String(Number(value.toFixed(2)));
const planDateLabel = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

const INPUT_CLASS = 'relative z-[1] min-h-[clamp(60px,8vw,80px)] w-full border-[3px] border-black bg-surface px-[clamp(13px,1.6vw,18px)] py-2 pr-[clamp(38px,5vw,52px)] font-sans text-[clamp(30px,4vw,40px)] leading-[.95] font-black text-black placeholder:font-term placeholder:text-[14px] placeholder:font-bold placeholder:tracking-normal placeholder:text-grey/70 shadow-[2px_2px_0_var(--shadow-color)] outline-none focus:border-orange focus:outline-2 focus:outline-lime focus:outline-offset-2';

const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Device-local memory of the last-picked section, so a returning visitor
// lands straight on their inputs instead of re-picking every time. It lives in
// a cookie (not localStorage) so the server can render the chosen section in
// the very first paint, with no flash of the year picker. This is separate
// from (and doesn't undo) the deliberate choice elsewhere to ignore a
// shareable ?section= URL param on load.
// Older visits stored the section in localStorage; read it once and move it.
const LEGACY_SECTION_STORAGE_KEY = 'dontbunk:lastSectionId';

function storeSectionId(sectionId: string) {
  try {
    document.cookie = `${SECTION_COOKIE}=${encodeURIComponent(sectionId)}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(SECTION_PICKED_EVENT));
  } catch {
    // Ignore — e.g. cookies disabled.
  }
}

function readLegacySectionId(): string | null {
  try {
    return window.localStorage.getItem(LEGACY_SECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Current IST time as HH:MM. */
function currentIstTime(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return parts; // "HH:MM"
}

/** Human-friendly "held through yesterday" caption for the Current attendance input. */
function heldThroughYesterdayLabel(config: ScheduleConfig, now: Date): string {
  const today = currentIstDate(now);
  const calendar = buildCalendar(config, now);
  const count = calendar.heldThroughYesterday.length;
  if (today < config.semesterStart) {
    const startsLabel = formatter.format(new Date(`${config.semesterStart}T00:00:00`));
    return `Semester starts ${startsLabel} · 0 periods so far`;
  }
  if (calendar.future.length === 0 && count === 0) {
    return 'Semester ended · 0 periods so far';
  }
  // Yesterday in IST, not the user's wall clock — matches the engine. The
  // subtraction uses UTC arithmetic on the IST calendar date (safe: it's a
  // plain date, no time-of-day or DST involved), then the result is
  // re-parsed as a local midnight before formatting — the same pattern the
  // other labels in this file use — so the displayed date is always the
  // correct IST day regardless of the viewer's own timezone.
  const yesterdayUtc = new Date(`${today}T00:00:00Z`);
  yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
  const yesterdayIso = yesterdayUtc.toISOString().slice(0, 10);
  const throughLabel = formatter.format(new Date(`${yesterdayIso}T00:00:00`));
  return `${count} period${count === 1 ? '' : 's'} held through ${throughLabel}`;
}

/** Build AttendanceAdjustments from the component's override and today-input state. */
function buildAdjustments(
  overrides: Map<string, 'attended' | 'bunked'>,
  todayInput: Map<number, boolean | 'auto'>,
  upcomingInput: Map<number, boolean>,
  todayPeriods: DatedPeriod[],
  currentIstTimeStr: string,
): AttendanceAdjustments {
  const periodOverrides = [...overrides.entries()].map(([key, status]) => {
    const [date, seqStr] = key.split(':');
    return { date, sequence: Number(seqStr), status };
  });

  // Split today's periods by time: completed/ongoing vs upcoming.
  const completedPeriodInputs: AttendanceAdjustments['todayPeriods'] = [];

  for (const period of todayPeriods) {
    const isExam = period.start === '00:00' && period.end === '23:59';
    const isUpcoming = !isExam && currentIstTimeStr < period.start;

    if (isUpcoming) {
      // Upcoming period: stays in the future bucket by default.
      // Only create a future override if the user is bunking it.
      const attending = upcomingInput.get(period.sequence) ?? true;
      if (!attending) {
        periodOverrides.push({
          date: period.date,
          sequence: period.sequence,
          status: 'bunked',
        });
      }
    } else {
      // Completed/ongoing: include in todayPeriods with auto/attended/bunked.
      // Untagged periods (absent from todayInput) are excluded — they
      // shouldn't reach here if the UI enforces compulsory tagging.
      const value = todayInput.get(period.sequence);
      if (value !== undefined) {
        completedPeriodInputs.push({
          sequence: period.sequence,
          attending: value, // boolean | 'auto'
        });
      }
    }
  }

  return { periodOverrides, todayPeriods: completedPeriodInputs };
}

type CalculatorProps = {
  sections: SectionOption[];
  /** Map of section id -> that section's loaded ScheduleConfig. */
  configsBySection: Record<string, ScheduleConfig>;
  /** Display name for each section id. */
  namesBySection: Record<string, string>;
  /** Section remembered from the last visit (read from a cookie on the server), or ''. */
  initialSectionId?: string;
};

export function Calculator({ sections, configsBySection, namesBySection, initialSectionId = '' }: CalculatorProps) {
  // The active section lives here, not in the parent, so the card stays
  // mounted when the user switches chips. That means the rise-in animation
  // only plays once (on first load), and there is no remount flash.
  // `explicitSectionId` is null until the user has actually chosen something;
  // `activeId` falls back to the section remembered from the last visit, which
  // the server already knows (cookie), so the first paint is the right one.
  const [explicitSectionId, setExplicitSectionId] = useState<string | null>(null);
  const activeId = explicitSectionId ?? (sections.some((section) => section.id === initialSectionId) ? initialSectionId : '');

  // One-time move of the old localStorage memory into the cookie.
  useEffect(() => {
    if (initialSectionId) return;
    const legacy = readLegacySectionId();
    if (legacy && sections.some((section) => section.id === legacy)) {
      storeSectionId(legacy);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExplicitSectionId(legacy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('75');
  // True once the user has pressed the button for the active section. The
  // numbers themselves are derived live (see `result` below) so they can never
  // disagree with the inputs on screen.
  const [hasCalculated, setHasCalculated] = useState(false);
  const [currentError, setCurrentError] = useState('');
  const [targetError, setTargetError] = useState('');
  const [formError, setFormError] = useState('');
  const [calculating, setCalculating] = useState(false);
  // Bumped only inside calculate() so the Results panel remounts (and
  // its flash replays) exclusively on a fresh button press, never on
  // an input change.
  const [resultSeq, setResultSeq] = useState(0);
  // Track the section we calculated for so the Result renders with the
  // right `config.semesterEnd` even after a switch. We don't try to
  // reconcile the previous numbers — switching clears them.
  const [resultFor, setResultFor] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [calHovered, setCalHovered] = useState(false);
  const [calPressed, setCalPressed] = useState(false);
  const calculationTimer = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // --- Adjustment state ---
  const [overrides, setOverrides] = useState<Map<string, 'attended' | 'bunked'>>(new Map());
  const [todayInput, setTodayInput] = useState<Map<number, boolean | 'auto'>>(new Map());
  const [upcomingInput, setUpcomingInput] = useState<Map<number, boolean>>(new Map());

  // Scroll the result into view on every fresh calculation (resultSeq only
  // bumps inside calculate(), never on mount), so a student who taps the
  // button on a short viewport isn't left staring at an unchanged screen.
  useEffect(() => {
    if (resultSeq === 0) return;
    resultsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, [resultSeq]);

  // Load persisted adjustments when section changes.
  useEffect(() => {
    if (!activeId) return;
    const todayIst = currentIstDate(new Date());
    const saved = loadAdjustments(activeId, todayIst);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverrides(saved.overrides);
       
      setTodayInput(saved.todayInput);
      setUpcomingInput(saved.upcomingInput);
    } else {
       
      setOverrides(new Map());
       
      setTodayInput(new Map());
      setUpcomingInput(new Map());
    }
  }, [activeId]);

  // Section switch: drop the per-section inputs and any result so the user
  // never sees stale numbers from a different timetable.
  const firstRender = useRef(true);
  useEffect(() => {
    if (calculationTimer.current !== null) {
      window.clearTimeout(calculationTimer.current);
      calculationTimer.current = null;
    }
    if (firstRender.current) { firstRender.current = false; return; }
    setCurrent('');
    setCurrentError('');
    setTargetError('');
    setFormError('');
    setHasCalculated(false);
    setResultFor('');
    setShowCalendar(false);
  }, [activeId]);

  useEffect(() => () => {
    if (calculationTimer.current !== null) window.clearTimeout(calculationTimer.current);
  }, []);

  const active = sections.find((section) => section.id === activeId);
  const config = active ? configsBySection[active.id] : undefined;
  const sectionName = active ? (namesBySection[active.id] ?? active.name) : null;
  // Use the section the result was computed for, so the footer date stays
  // correct after a section switch.
  const resultSection = sections.find((section) => section.id === resultFor);
  const resultEndDate = resultSection ? configsBySection[resultSection.id]?.semesterEnd : undefined;
  // Memoized on `config` alone — the helper is pure and cheap enough that
  // we don't need to track `now` in React state. The day bucket will only
  // change in practice when the user re-opens the page or switches sections.
  const heldCaption = useMemo(
    () => (config ? heldThroughYesterdayLabel(config, new Date()) : ''),
    [config],
  );

  // Today's periods for the active section.
  const todayPeriods = useMemo(
    () => (config ? buildCalendar(config, new Date()).today : []),
    [config],
  );

  const [istTime, setIstTime] = useState(() => currentIstTime());

  // Persist adjustments whenever they change.
  useEffect(() => {
    if (!activeId) return;
    const todayIst = currentIstDate(new Date());
    saveAdjustments(activeId, todayIst, overrides, todayInput, upcomingInput);
  }, [activeId, overrides, todayInput, upcomingInput]);

  // Count untagged completed/ongoing periods to enforce compulsory tagging.
  const untaggedCount = useMemo(() => {
    let count = 0;
    for (const period of todayPeriods) {
      const isExam = period.start === '00:00' && period.end === '23:59';
      if (isExam || period.start <= istTime) {
        if (!todayInput.has(period.sequence)) count += 1;
      }
    }
    return count;
  }, [todayPeriods, istTime, todayInput]);


  // Adjustment counts for the summary line.
  const adjustmentSummary = useMemo(() => {
    // Days before today are corrections to what already happened; days after
    // it are plans. They are reported separately because only the first kind
    // changes the "held so far" numbers.
    const todayIso = currentIstDate(new Date());
    let overrideAttended = 0;
    let overrideBunked = 0;
    let plannedBunks = 0;
    for (const [key, status] of overrides) {
      const date = key.split(':')[0];
      if (date > todayIso) {
        if (status === 'bunked') plannedBunks += 1;
      } else if (status === 'attended') overrideAttended += 1;
      else overrideBunked += 1;
    }
    let todayAttended = 0;
    let todayBunked = 0;
    let todayBunkingLater = 0;
    let autoPeriods = 0;
    for (const period of todayPeriods) {
      const isExam = period.start === '00:00' && period.end === '23:59';
      if (isExam || period.start <= istTime) {
        const val = todayInput.get(period.sequence);
        if (val === true) todayAttended += 1;
        else if (val === false) todayBunked += 1;
        else if (val === 'auto') autoPeriods += 1;
      } else {
        const val = upcomingInput.get(period.sequence) ?? true;
        if (val === false) todayBunkingLater += 1;
      }
    }
    // 'auto' means "already reflected in portal", so it is not an *adjustment*
    // to the portal %. Every manual tag (attended or bunked) is.
    const total = overrideAttended + overrideBunked + plannedBunks + todayAttended + todayBunked + todayBunkingLater;
    return { overrideAttended, overrideBunked, plannedBunks, todayAttended, todayBunked, todayBunkingLater, total, autoPeriods };
  }, [overrides, todayInput, upcomingInput, todayPeriods, istTime]);

  // Logo click: send the user back to the blank picker. We prevent the
  // Link's default navigation and clear state in place — no full page
  // reload, no remount flash, no leftover ?section= in the URL.
  function handleHomeClick() {
    setExplicitSectionId('');
    setCalculating(false);
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return true;
  }

  function handleSectionSelect(sectionId: string) {
    setCalculating(false);
    setExplicitSectionId(sectionId);
    if (sectionId) storeSectionId(sectionId);
  }

  const handleOverrideChange = useCallback((date: string, sequence: number, status: 'attended' | 'bunked' | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const key = `${date}:${sequence}`;
      if (status === null) {
        next.delete(key);
      } else {
        next.set(key, status);
      }
      return next;
    });
  }, []);

  const handleTodayChange = useCallback((sequence: number, value: boolean | 'auto' | null) => {
    setTodayInput((prev) => {
      const next = new Map(prev);
      if (value === null) next.delete(sequence);
      else next.set(sequence, value);
      return next;
    });
  }, []);

  const handleUpcomingChange = useCallback((sequence: number, attending: boolean) => {
    setUpcomingInput((prev) => {
      const next = new Map(prev);
      next.set(sequence, attending);
      return next;
    });
  }, []);

  // Today's cell in the calendar jumps to the card where today is edited.
  const handleGoToToday = useCallback(() => {
    const card = document.getElementById('today-classes');
    if (!card) return;
    const toggle = card.querySelector<HTMLButtonElement>('button[aria-expanded]');
    if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    toggle?.focus({ preventScroll: true });
  }, []);

  const handleResetAdjustments = useCallback(() => {
    setConfirmingReset(false);
    setOverrides(new Map());
    setTodayInput(new Map());
    setUpcomingInput(new Map());
    if (activeId) clearAdjustments(activeId);
  }, [activeId]);

  const currentNum = Number(current);
  const targetNum = Number(target);
  const isCurrentInvalid = current.trim() !== '' && (!Number.isFinite(currentNum) || currentNum < 0 || currentNum > 100);
  const isTargetInvalid = target.trim() !== '' && (!Number.isFinite(targetNum) || targetNum <= 0 || targetNum > 100);
  const currentInvalid = isCurrentInvalid || currentError !== '';
  const targetInvalid = isTargetInvalid || targetError !== '';
  const blockers: string[] = [];
  if (current.trim() === '') blockers.push('Enter your current attendance above.');
  if (target.trim() === '') blockers.push('Enter your target attendance above.');
  if (isCurrentInvalid) blockers.push('Fix your current attendance above (0 to 100).');
  if (isTargetInvalid) blockers.push('Fix your target attendance above (1 to 100).');
  if (untaggedCount > 0) blockers.push(`Tag ${untaggedCount} finished class${untaggedCount > 1 ? 'es' : ''} in Today's Classes, or tap Mark all Auto.`);
  const inputsReady = current.trim() !== '' && target.trim() !== '' && !isCurrentInvalid && !isTargetInvalid;

  // The numbers on screen are always derived from the inputs on screen, so
  // editing attendance, target, or any tag updates the card in place. It only
  // disappears (rather than going stale) while an input is blank/invalid or a
  // finished period is untagged — the button explains what is missing.
  const result: AttendanceResult | null = useMemo(() => {
    if (!hasCalculated || !config || !inputsReady || untaggedCount > 0) return null;
    return calculateAttendance({
      config,
      now: new Date(),
      currentPercentage: currentNum,
      targetPercentage: targetNum,
      adjustments: buildAdjustments(overrides, todayInput, upcomingInput, todayPeriods, istTime),
    });
  }, [hasCalculated, config, inputsReady, untaggedCount, currentNum, targetNum, overrides, todayInput, upcomingInput, todayPeriods, istTime]);

  function calculate() {
    if (calculating) return;
    if (!activeId || !config) return;
    if (current.trim() === '') {
      setCurrentError('Enter your attendance to find out.');
      return;
    }
    if (target.trim() === '') {
      setTargetError('Enter a target attendance between 1 and 100.');
      return;
    }
    if (isCurrentInvalid) {
      setCurrentError('Enter a number from 0 to 100.');
      return;
    }
    if (isTargetInvalid) {
      setTargetError('Enter a number from 1 to 100.');
      return;
    }
    if (untaggedCount > 0) {
      // Button should be disabled anyway, but block explicitly just in case
      setFormError(`Tag all completed periods first (${untaggedCount} left).`);
      return;
    }
    setCurrentError('');
    setTargetError('');
    setFormError('');
    setCalculating(true);

    // Refresh time exactly when they hit Calculate, so the ongoing vs future
    // boundary is accurate to the exact moment of computation.
    setIstTime(currentIstTime());

    // Brief spinner so the result reveal feels intentional.
    calculationTimer.current = window.setTimeout(() => {
      calculationTimer.current = null;
      setHasCalculated(true);
      setResultFor(activeId);
      setResultSeq((n) => n + 1);
      setCalculating(false);
    }, 250);
  }

  return (
    <>
      <SiteHeader onHomeClick={handleHomeClick} showHowItWorks />
      <main className="mx-auto w-full max-w-[680px] min-h-[calc(100vh-47px)] px-5 pt-3 pb-[calc(56px+env(safe-area-inset-bottom))] phone:px-3 phone:pb-[calc(44px+env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[680px] border-[3px] border-black bg-paper px-[clamp(16px,2vw,24px)] pt-[clamp(17px,2vw,24px)] pb-[clamp(18px,2.2vw,26px)] shadow-hard animate-rise" aria-label="Attendance calculator">
          <div className="mb-[clamp(16px,2vw,22px)]">
            <h1 className="m-0 font-display text-[clamp(27px,4.4vw,40px)] leading-[.95] font-black uppercase tracking-[.2px] mb-1.5">Can I bunk?</h1>
            <p className="m-0 font-term text-[12px] text-muted">Check your safe bunk count in seconds.</p>
          </div>

          <SectionSelector sections={sections} selectedSectionId={activeId} onSelect={handleSectionSelect} />

          <div className={`grid transition-all duration-300 ease-in-out ${active ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'}`}>
            <div className="overflow-hidden px-2 pb-[10px] -mx-2 -mb-[10px]">
              <form key={activeId} onSubmit={(event) => { event.preventDefault(); calculate(); }} noValidate>
                <div className="mb-[clamp(17px,2vw,22px)]">
                  <label htmlFor="current-attendance" className="mb-[clamp(7px,.8vw,10px)] block text-[12px] leading-[1.1] font-black text-black">Current attendance %</label>
                  <div className="relative">
                    <input
                      id="current-attendance"
                      className={`${INPUT_CLASS} ${currentInvalid ? 'input-error' : ''}`}
                      data-managed-validation=""
                      type="number" min="0" max="100" step="any" inputMode="decimal"
                      value={current} placeholder="Enter your attendance"
                      onChange={(event) => { setCurrent(event.target.value); if (currentError) setCurrentError(''); }}
                      onBlur={() => { if (current.trim() === '') setCurrentError('Enter your attendance to find out.'); }}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (untaggedCount === 0) calculate(); } }}
                      aria-invalid={currentInvalid ? true : undefined}
                      aria-describedby={['current-help', currentInvalid ? 'current-error' : ''].filter(Boolean).join(' ')}
                    />
                    <span className="absolute right-[clamp(12px,1.6vw,18px)] bottom-[clamp(13px,2.4vw,24px)] z-[2] font-term text-[clamp(20px,2.6vw,26px)] leading-none font-black text-grey" aria-hidden="true">%</span>
                  </div>
                  {currentInvalid && <p id="current-error" className="mt-1 m-0 font-term text-[12px] font-bold text-error">{currentError || 'Enter a number from 0 to 100.'}</p>}
                  <p id="current-help" className="mt-1.5 m-0 font-term text-[12px] leading-[1.3] text-muted">{heldCaption}</p>
                </div>

                <div className="mb-[clamp(17px,2vw,22px)]">
                  <label htmlFor="target-attendance" className="mb-[clamp(7px,.8vw,10px)] block text-[12px] leading-[1.1] font-black text-black">Target attendance %</label>
                  <div className="relative">
                    <input
                      id="target-attendance"
                      className={`${INPUT_CLASS} ${targetInvalid ? 'input-error' : ''}`}
                      data-managed-validation=""
                      type="number" min="0" max="100" step="any" inputMode="decimal"
                      value={target} placeholder="Enter target attendance"
                      onChange={(event) => { setTarget(event.target.value); if (targetError) setTargetError(''); }}
                      onBlur={() => { if (target.trim() === '') setTargetError('Enter a target attendance between 1 and 100.'); }}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (untaggedCount === 0) calculate(); } }}
                      aria-invalid={targetInvalid ? true : undefined}
                      aria-describedby={targetInvalid ? 'target-error' : undefined}
                    />
                    <span className="absolute right-[clamp(12px,1.6vw,18px)] bottom-[clamp(13px,2.4vw,24px)] z-[2] font-term text-[clamp(20px,2.6vw,26px)] leading-none font-black text-grey" aria-hidden="true">%</span>
                  </div>
                  {targetInvalid && <p id="target-error" className="mt-1 m-0 font-term text-[12px] font-bold text-error">{targetError || 'Enter a number from 1 to 100.'}</p>}
                </div>

                    {active && config && todayPeriods.length > 0 && (
                      <div id="today-classes" className="mb-4 scroll-mt-4">
                        <TodayClasses
                          periods={todayPeriods}
                          currentIstTime={istTime}
                          todayValues={todayInput}
                          upcomingValues={upcomingInput}
                          onTodayChange={handleTodayChange}
                          onUpcomingChange={handleUpcomingChange}
                          untaggedCount={untaggedCount}
                        />
                      </div>
                    )}

                    {formError && <p className="mb-[13px] border-2 border-black bg-danger-bg p-2 font-term text-[12px] leading-[1.3] font-bold text-error" role="alert">{formError}</p>}

                    {blockers.length > 0 && (
                      <ul id="submit-blockers" className="m-0 mb-3 grid list-none gap-1 p-0 font-term text-[12px] leading-[1.35] font-bold text-error">
                        {blockers.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    )}

                    <button className="btn-calculate btn-calculate-hover" type="submit" disabled={calculating || blockers.length > 0} aria-busy={calculating} aria-describedby={blockers.length > 0 ? 'submit-blockers' : undefined}>
                      {calculating ? 'Calculating…' : 'Can I bunk?'}
                    </button>
              </form>
            </div>
          </div>
        </section>

        {/* Announces the headline answer to screen readers whenever it changes. */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{result ? resultAnnouncement(result) : ''}</p>

        {/* Adjustment summary, now living outside the main card */}
        {result && (adjustmentSummary.total > 0 || Math.abs(result.updatedCurrentPercentage - result.currentPercentage) > 0.001 || result.plannedPeriods > 0) && (
          <div className="mx-auto mt-4 w-full max-w-[680px] border-[3px] border-black bg-surface px-[clamp(16px,2vw,20px)] py-[clamp(12px,1.5vw,16px)] shadow-[4px_4px_0_var(--shadow-color)] animate-rise">
            {adjustmentSummary.total > 0 && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 whitespace-nowrap font-term text-[12px] leading-[1.4] font-bold text-black">
                    Adjustments <span className="font-normal text-muted">({adjustmentSummary.total} period{adjustmentSummary.total !== 1 ? 's' : ''})</span>
                  </p>
                  {confirmingReset ? (
                    <span className="-my-2 inline-flex items-center gap-1">
                      <button type="button" onClick={handleResetAdjustments} className="inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap px-2 font-term text-[12px] font-bold text-error underline decoration-dotted underline-offset-2">Yes, reset</button>
                      <button type="button" onClick={() => setConfirmingReset(false)} className="inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap px-2 font-term text-[12px] font-bold text-black underline decoration-dotted underline-offset-2">Cancel</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmingReset(true)} className="-my-2 inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap px-2 font-term text-[12px] font-bold text-link underline decoration-dotted underline-offset-2 hover:text-black">Reset all</button>
                  )}
                </div>
                <p className="m-0 mb-1 flex flex-wrap gap-x-3 font-term text-[12px] leading-[1.4]">
                  {adjustmentSummary.overrideAttended > 0 && <span className="whitespace-nowrap text-success">+{adjustmentSummary.overrideAttended} attended</span>}
                  {adjustmentSummary.overrideBunked > 0 && <span className="whitespace-nowrap text-error">−{adjustmentSummary.overrideBunked} bunked</span>}
                  {adjustmentSummary.todayAttended > 0 && <span className="whitespace-nowrap text-success">+{adjustmentSummary.todayAttended} attended today</span>}
                  {adjustmentSummary.todayBunked > 0 && <span className="whitespace-nowrap text-error">−{adjustmentSummary.todayBunked} bunked today</span>}
                  {adjustmentSummary.todayBunkingLater > 0 && <span className="whitespace-nowrap text-error">{adjustmentSummary.todayBunkingLater} bunking later today</span>}
                  {adjustmentSummary.plannedBunks > 0 && <span className="whitespace-nowrap text-error">{adjustmentSummary.plannedBunks} planned bunk{adjustmentSummary.plannedBunks !== 1 ? 's' : ''}</span>}
                </p>
              </>
            )}
            {Math.abs(result.updatedCurrentPercentage - result.currentPercentage) > 0.001 && (
              <p className={`m-0 flex items-baseline justify-between gap-3 whitespace-nowrap font-term text-[12px] leading-[1.4] ${adjustmentSummary.total > 0 ? 'mt-2 border-t border-black/15 pt-2' : ''}`}>
                <span className="font-bold text-black">Updated attendance</span>
                <span><span className="font-bold text-black">{result.updatedCurrentPercentage.toFixed(2)}%</span> <span className="text-muted">({exactCount(result.attendedSoFar)}/{result.heldSoFar} periods)</span></span>
              </p>
            )}
            {result.plannedPeriods > 0 && (
              <p className={`m-0 flex items-baseline justify-between gap-3 whitespace-nowrap font-term text-[12px] leading-[1.4] ${adjustmentSummary.total > 0 || Math.abs(result.updatedCurrentPercentage - result.currentPercentage) > 0.001 ? 'mt-2 border-t border-black/15 pt-2' : ''}`}>
                <span className="font-bold text-black">Projected{result.projectedThrough ? ` by ${planDateLabel(result.projectedThrough)}` : ''}</span>
                <span className="font-bold text-black">{result.projectedPercentage.toFixed(2)}%</span>
              </p>
            )}
          </div>
        )}

        {result && resultEndDate ? <div ref={resultsRef} className="mt-9 phone:mt-[30px]"><Results key={resultSeq} result={result} endDate={resultEndDate} todayCounted={adjustmentSummary.todayAttended + adjustmentSummary.todayBunked + adjustmentSummary.autoPeriods} /></div> : null}

        {/* Collapsible calendar: same card, header and motion as Today's Classes. */}
        {active && config ? (
          <div className={`mx-auto mt-9 flex w-full max-w-[680px] flex-col border-[3px] border-black bg-[#f0ece1] transition-all duration-150 phone:mt-[30px] ${
            !showCalendar && calPressed ? 'translate-y-[3px] translate-x-[3px] shadow-[1px_1px_0_var(--shadow-color)]' :
            !showCalendar && calHovered ? '-translate-y-[2px] -translate-x-[2px] shadow-[6px_6px_0_var(--shadow-color)]' :
            'shadow-[4px_4px_0_var(--shadow-color)]'
          }`}>
            <button
              type="button"
              onClick={() => setShowCalendar((value) => !value)}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setCalHovered(true); }}
              onPointerLeave={() => { setCalHovered(false); setCalPressed(false); }}
              onMouseDown={() => setCalPressed(true)}
              onMouseUp={() => setCalPressed(false)}
              onTouchStart={() => setCalPressed(true)}
              onTouchEnd={() => setCalPressed(false)}
              className={`flex w-full cursor-pointer items-center justify-between bg-surface px-[clamp(16px,2vw,20px)] py-[clamp(12px,1.5vw,16px)] transition-colors hover:bg-lime hover:text-black ${showCalendar ? 'border-b-[3px] border-black' : ''}`}
              aria-expanded={showCalendar}
            >
              <div className="flex flex-col items-start gap-1 text-left">
                <h2 className="m-0 font-term text-[14px] font-black text-inherit">Sem Calendar (Plan your bunks)</h2>
                <span className="font-term text-[12px] opacity-70">Tap a day to fix past periods or plan ahead</span>
              </div>
              <span aria-hidden="true" className="font-display text-[24px] leading-none font-black uppercase">{showCalendar ? '−' : '+'}</span>
            </button>
            <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ height: showCalendar ? 'auto' : 0 }}>
              <div className="px-[clamp(16px,2vw,20px)] pb-[clamp(16px,2vw,20px)] pt-3">
                <div className="mb-4 mt-1 h-[2px] bg-black/20" />
                <MonthCalendar
                  config={config}
                  overrides={overrides}
                  onOverrideChange={handleOverrideChange}
                  onTodayClick={todayPeriods.length > 0 ? handleGoToToday : undefined}
                />
              </div>
            </div>
          </div>
        ) : null}

        <a className="show-desktop mx-auto mt-[clamp(16px,2vw,24px)] flex min-h-11 w-full max-w-[680px] items-center justify-center py-[3px] text-center font-term text-[12px] font-bold text-black underline hover:bg-black/5 hover:text-black" href="/admin">Admin panel</a>
      </main>
    </>
  );
}
