'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScheduleConfig, TimetablePeriod, Weekday } from '@/domain/schedule/types';
import { buildCalendar } from '@/domain/schedule/calendar';
import { saveSemesterConfig } from './actions';

const days: [Weekday, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday']];
type SectionOption = { id: string; name: string };
type DateInputProps = { value: string; onChange: (value: string) => void; ariaLabel?: string };

export function ConfigEditor({ initialConfig, sections, selectedSectionId, initialSectionName }: { initialConfig: ScheduleConfig; sections: SectionOption[]; selectedSectionId: string; initialSectionName: string }) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [sectionName, setSectionName] = useState(initialSectionName);
  const [sectionChoice, setSectionChoice] = useState(selectedSectionId);
  const [draggedPeriod, setDraggedPeriod] = useState<number | null>(null);
  const [state, action, pending] = useActionState(saveSemesterConfig, {});
  const calendar = buildCalendar(config, new Date());
  const semesterPeriodCount = calendar.heldThroughYesterday.length + calendar.today.length + calendar.future.length;
  useEffect(() => { if (state.success) router.refresh(); }, [router, state.success]);
  const update = (changes: Partial<ScheduleConfig>) => setConfig((current) => ({ ...current, ...changes }));
  const updatePeriod = (index: number, changes: Partial<TimetablePeriod>) => update({ timetable: config.timetable.map((period, periodIndex) => periodIndex === index ? { ...period, ...changes } : period) });
  const addPeriod = (weekday: Weekday) => { const dayPeriods = config.timetable.filter((period) => period.weekday === weekday); const previousEnd = dayPeriods.at(-1)?.end ?? '09:10'; const [hours, minutes] = previousEnd.split(':').map(Number); const nextEnd = `${String((hours + 1) % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; update({ timetable: [...config.timetable, { weekday, sequence: dayPeriods.length + 1, start: previousEnd, end: nextEnd }] }); };
  const removePeriod = (index: number) => { const remaining = config.timetable.filter((_, periodIndex) => periodIndex !== index); update({ timetable: remaining.map((period) => ({ ...period, sequence: remaining.filter((item) => item.weekday === period.weekday).findIndex((item) => item === period) + 1 })) }); };
  const movePeriod = (fromIndex: number, toIndex: number) => { if (toIndex < 0 || toIndex >= config.timetable.length || config.timetable[toIndex]?.weekday !== config.timetable[fromIndex]?.weekday) return; const reordered = [...config.timetable]; const [period] = reordered.splice(fromIndex, 1); reordered.splice(toIndex, 0, period); update({ timetable: reordered.map((item) => item.weekday === period.weekday ? { ...item, sequence: reordered.filter((candidate) => candidate.weekday === period.weekday).findIndex((candidate) => candidate === item) + 1 } : item) }); };
  const addHoliday = () => update({ holidays: [...config.holidays, { name: 'Holiday', start: config.semesterStart, end: config.semesterStart }] });
  const removeHoliday = (index: number) => update({ holidays: config.holidays.filter((_, itemIndex) => itemIndex !== index) });
  const addSaturday = () => update({ specialSaturdays: [...config.specialSaturdays, { date: config.semesterStart, copiedWeekday: 2 }] });
  const removeSaturday = (index: number) => update({ specialSaturdays: config.specialSaturdays.filter((_, itemIndex) => itemIndex !== index) });
  const addExam = (name: 'Mid 1' | 'Mid 2') => update({ exams: [...config.exams.filter((exam) => exam.name !== name), { name, start: config.semesterStart, end: config.semesterStart, periodsPerDay: 4, dailyPeriods: [] }] });
  const removeExam = (name: 'Mid 1' | 'Mid 2') => update({ exams: config.exams.filter((exam) => exam.name !== name) });
  const updateExam = (name: 'Mid 1' | 'Mid 2', changes: Partial<ScheduleConfig['exams'][number]>) => update({ exams: config.exams.map((exam) => exam.name === name ? { ...exam, ...changes } : exam) });

  return <form className="config-editor" action={action}>
    <div className="admin-heading"><div><p className="eyebrow">Schedule basics</p><h2>Current semester</h2></div><button className="calculate" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save changes'} <span aria-hidden="true">↗</span></button></div>
    <div className="admin-fields"><label>Choose section<select value={sectionChoice} onChange={(event) => { const choice = event.target.value; setSectionChoice(choice); if (choice === '__new__') { setSectionName(''); return; } router.push(`/admin?section=${choice}`); }}><option value="" disabled>{sections.length === 0 ? 'No sections saved yet' : 'Choose a section'}</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}<option value="__new__">+ Create new section from this one</option></select></label><label>Section name<input value={sectionName} onChange={(event) => setSectionName(event.target.value)} /><small className="field-help">Choose the create option, enter a new name, then save. All current details will be copied.</small></label><label>Semester starts<DateInput value={config.semesterStart} onChange={(value) => update({ semesterStart: value })} /></label><label>Semester ends<DateInput value={config.semesterEnd} onChange={(value) => update({ semesterEnd: value })} /></label></div>
    <input type="hidden" name="sectionName" value={sectionName} /><input type="hidden" name="config" value={JSON.stringify(config)} />
    <section className="config-section"><div className="admin-heading"><div><p className="eyebrow">Weekly timetable</p><h2>Periods by weekday</h2></div><div className="counter-group"><div className="semester-counter"><strong>{config.timetable.length}</strong><span>regular / week</span></div><div className="semester-counter"><strong>{semesterPeriodCount}</strong><span>periods this semester</span></div></div></div>{days.map(([weekday, label]) => <div className="day-editor" key={weekday}><div className="day-title"><strong>{label}</strong><button type="button" onClick={() => addPeriod(weekday)}>+ period</button></div>{config.timetable.map((period, index) => period.weekday === weekday && <div className="period-row" key={`${weekday}-${index}`} draggable onDragStart={() => setDraggedPeriod(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedPeriod !== null) movePeriod(draggedPeriod, index); setDraggedPeriod(null); }}><span>#{period.sequence}</span><input aria-label={`${label} period start`} type="time" value={period.start} onChange={(event) => updatePeriod(index, { start: event.target.value })} /><span className="arrow">to</span><input aria-label={`${label} period end`} type="time" value={period.end} onChange={(event) => updatePeriod(index, { end: event.target.value })} /><button type="button" aria-label={`Move ${label} period up`} onClick={() => movePeriod(index, index - 1)}>↑</button><button type="button" aria-label={`Move ${label} period down`} onClick={() => movePeriod(index, index + 1)}>↓</button><button type="button" aria-label={`Remove ${label} period`} onClick={() => removePeriod(index)}>×</button></div>)}</div>)}</section>
    <ConfigList title="Mid examinations" actionLabel="+ exam" onAdd={() => addExam(config.exams.some((exam) => exam.name === 'Mid 1') ? 'Mid 2' : 'Mid 1')}>{(['Mid 1', 'Mid 2'] as const).map((name) => { const exam = config.exams.find((item) => item.name === name); return exam && <div className="exam-editor" key={name}><div className="config-row"><strong>{name}</strong><DateInput ariaLabel={`${name} start`} value={exam.start} onChange={(value) => updateExam(name, { start: value })} /><DateInput ariaLabel={`${name} end`} value={exam.end} onChange={(value) => updateExam(name, { end: value })} /><select aria-label={`${name} default periods per day`} value={exam.periodsPerDay} onChange={(event) => updateExam(name, { periodsPerDay: Number(event.target.value) as 2 | 4 })}><option value="2">2 periods/day default</option><option value="4">4 periods/day default</option></select><button className="remove-button" type="button" aria-label={`Remove ${name}`} onClick={() => removeExam(name)}>×</button></div><small className="field-help">Use the default above, then override individual exam dates below.</small>{exam.dailyPeriods?.map((day, dayIndex) => <div className="config-row exam-day-row" key={`${name}-${dayIndex}`}><DateInput ariaLabel={`${name} override date`} value={day.date} onChange={(value) => updateExam(name, { dailyPeriods: exam.dailyPeriods?.map((entry, entryIndex) => entryIndex === dayIndex ? { ...entry, date: value } : entry) })} /><select aria-label={`${name} override periods`} value={day.periodsPerDay} onChange={(event) => updateExam(name, { dailyPeriods: exam.dailyPeriods?.map((entry, entryIndex) => entryIndex === dayIndex ? { ...entry, periodsPerDay: Number(event.target.value) as 2 | 4 } : entry) })}><option value="2">2 periods</option><option value="4">4 periods</option></select><button className="remove-button" type="button" aria-label={`Remove ${name} daily override`} onClick={() => updateExam(name, { dailyPeriods: exam.dailyPeriods?.filter((_, entryIndex) => entryIndex !== dayIndex) })}>×</button></div>)}<button type="button" onClick={() => updateExam(name, { dailyPeriods: [...(exam.dailyPeriods ?? []), { date: exam.start, periodsPerDay: exam.periodsPerDay }] })}>+ date override</button></div>; })}</ConfigList>
    <ConfigList title="Universal holidays" actionLabel="+ holiday" onAdd={addHoliday}><p className="field-help">These holidays apply to every section.</p>{config.holidays.map((holiday, index) => <div className="config-row" key={index}><input aria-label="Holiday name" value={holiday.name} onChange={(event) => update({ holidays: config.holidays.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /><DateInput ariaLabel="Holiday start" value={holiday.start} onChange={(value) => update({ holidays: config.holidays.map((item, itemIndex) => itemIndex === index ? { ...item, start: value } : item) })} /><DateInput ariaLabel="Holiday end" value={holiday.end} onChange={(value) => update({ holidays: config.holidays.map((item, itemIndex) => itemIndex === index ? { ...item, end: value } : item) })} /><button className="remove-button" type="button" aria-label={`Remove ${holiday.name}`} onClick={() => removeHoliday(index)}>×</button></div>)}</ConfigList>
    <ConfigList title="Universal special Saturdays" actionLabel="+ Saturday" onAdd={addSaturday}><p className="field-help">These working Saturdays apply to every section.</p>{config.specialSaturdays.map((special, index) => <div className="config-row" key={index}><DateInput ariaLabel="Special Saturday date" value={special.date} onChange={(value) => update({ specialSaturdays: config.specialSaturdays.map((item, itemIndex) => itemIndex === index ? { ...item, date: value } : item) })} /><select aria-label="Copied weekday" value={special.copiedWeekday} onChange={(event) => update({ specialSaturdays: config.specialSaturdays.map((item, itemIndex) => itemIndex === index ? { ...item, copiedWeekday: Number(event.target.value) as Weekday } : item) })}><option value="1">Monday timetable</option><option value="2">Tuesday timetable</option><option value="3">Wednesday timetable</option><option value="4">Thursday timetable</option><option value="5">Friday timetable</option></select><button className="remove-button" type="button" aria-label="Remove special Saturday" onClick={() => removeSaturday(index)}>×</button></div>)}</ConfigList>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p className="success" role="status">{state.success}</p>}
  </form>;
}

function DateInput({ value, onChange, ariaLabel }: DateInputProps) {
  const [text, setText] = useState(formatDisplayDate(value));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseDisplayDate(text);
  const viewing = parsed ? new Date(`${parsed}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(viewing.getFullYear());
  const [viewMonth, setViewMonth] = useState(viewing.getMonth());

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false); }
    function handleKey(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [open]);

  function navigateMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function pickDate(day: number) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setText(formatDisplayDate(iso));
    onChange(iso);
    setOpen(false);
  }

  function toggleCalendar() {
    if (!open) {
      const p = parseDisplayDate(text);
      const d = p ? new Date(`${p}T00:00:00`) : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    setOpen(!open);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const blanks = (firstDay + 6) % 7; // Monday-start
  const selectedIso = parsed ?? '';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return <div className="date-input-wrapper" ref={containerRef}>
    <input inputMode="numeric" placeholder="dd/mm/yyyy" aria-label={ariaLabel} value={text} onChange={(event) => setText(event.target.value)} onBlur={() => { const p = parseDisplayDate(text); if (p) { setText(formatDisplayDate(p)); onChange(p); } }} />
    <button type="button" className="calendar-toggle" aria-label="Open calendar" onClick={toggleCalendar}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
    {open && <div className="calendar-popup">
      <div className="calendar-nav">
        <button type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month">‹</button>
        <span>{monthNames[viewMonth]} {viewYear}</span>
        <button type="button" onClick={() => navigateMonth(1)} aria-label="Next month">›</button>
      </div>
      <div className="calendar-grid">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d} className="calendar-weekday">{d}</span>)}
        {Array.from({ length: blanks }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = iso === selectedIso;
          const isToday = iso === new Date().toISOString().slice(0, 10);
          return <button type="button" key={day} className={`calendar-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`} onClick={() => pickDate(day)}>{day}</button>;
        })}
      </div>
    </div>}
  </div>;
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function parseDisplayDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}

function ConfigList({ title, actionLabel, onAdd, children }: { title: string; actionLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return <section className="config-section"><div className="admin-heading"><div><p className="eyebrow">Calendar exceptions</p><h2>{title}</h2></div><button type="button" onClick={onAdd}>{actionLabel}</button></div>{children}</section>;
}
