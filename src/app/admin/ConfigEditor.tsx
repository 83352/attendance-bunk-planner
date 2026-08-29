'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScheduleConfig, TimetablePeriod, Weekday } from '@/domain/schedule/types';
import { buildCalendar, currentIstDate, dateInRange, periodsForDate } from '@/domain/schedule/calendar';
import { deleteSection, renameSection, saveSemesterConfig } from './actions';

const days: [Weekday, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday']];
type SectionOption = { id: string; name: string };
type DateInputProps = { value: string; onChange: (value: string) => void; ariaLabel?: string };

// Shared admin building blocks (were .admin-heading / .config-section etc.)
const adminHeading = 'flex items-center justify-between gap-4 phone:flex-col phone:items-start';
const adminH2 = 'm-0 font-display text-[24px] leading-none font-black uppercase';
const configSection = 'grid gap-4 pt-[22px] border-t-[3px] border-dotted border-red';
const adminButton = 'border-2 border-black bg-paper px-3 py-[9px] cursor-pointer font-term text-[10px] font-black uppercase shadow-[2px_2px_0_var(--shadow-color)]';
const fieldLabel = 'grid gap-2 text-[10px] leading-[1.1] font-black text-black';
const adminInput = 'min-w-0 border-2 border-black bg-surface px-2 py-2.5 font-sans text-[12px] text-black outline-none focus:border-orange';
const removeButton = 'size-7 shrink-0 border-2 border-black bg-danger-bg font-term text-[20px] leading-none font-bold text-danger-ink cursor-pointer';
const fieldHelp = 'font-term text-[11px] leading-[1.4] text-muted';

export function ConfigEditor({ initialConfig, updatedAt, sections, selectedSectionId, initialSectionName }: { initialConfig: ScheduleConfig; updatedAt: string | null; sections: SectionOption[]; selectedSectionId: string; initialSectionName: string }) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [sectionName, setSectionName] = useState(initialSectionName);
  const [sectionChoice, setSectionChoice] = useState(selectedSectionId);
  const [draggedPeriod, setDraggedPeriod] = useState<number | null>(null);
  const [state, action, pending] = useActionState(saveSemesterConfig, {});
  const semesterPeriodCount = useMemo(() => {
    const calendar = buildCalendar(config, new Date());
    return calendar.heldThroughYesterday.length + calendar.today.length + calendar.future.length;
  }, [config]);
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
  const addCustomExam = () => {
    const used = new Set(config.exams.map((exam) => exam.name.trim().toLowerCase()));
    let index = config.exams.length + 1;
    let name = `Exam ${index}`;
    while (used.has(name.toLowerCase())) { index += 1; name = `Exam ${index}`; }
    update({ exams: [...config.exams, { name, start: config.semesterStart, end: config.semesterStart, periodsPerDay: 2, dailyPeriods: [] }] });
  };
  const removeExam = (name: string) => update({ exams: config.exams.filter((exam) => exam.name !== name) });
  const updateExam = (name: string, changes: Partial<ScheduleConfig['exams'][number]>) => update({ exams: config.exams.map((exam) => exam.name === name ? { ...exam, ...changes } : exam) });

  return <form className="mt-[34px] grid gap-[22px]" action={action}>
    <div className={adminHeading}><div><p className="eyebrow-text mb-[7px] text-[10px] text-muted">Schedule basics</p><h2 className={adminH2}>Current semester</h2></div><button className="btn-calculate btn-calculate-hover !w-auto min-w-[120px] disabled:cursor-wait disabled:opacity-65 phone:min-h-11" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save changes'} <span aria-hidden="true">↗</span></button></div>
    <div className="grid gap-3.5 border-[3px] border-black bg-paper p-[18px] shadow-hard">
      <label className={fieldLabel}>Choose section<select className="w-full border-2 border-black bg-surface px-2.5 py-2.5 font-term text-[13px] font-bold text-black outline-none focus:border-orange" value={sectionChoice} onChange={(event) => { const choice = event.target.value; setSectionChoice(choice); if (choice === '__new__') { setSectionName(''); return; } router.push(`/admin?section=${choice}`); }}><option value="" disabled>{sections.length === 0 ? 'No sections saved yet' : 'Choose a section'}</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}<option value="__new__">+ Create new section from this one</option></select></label>
      <label className={fieldLabel}>Section name<input className={adminInput} value={sectionName} onChange={(event) => setSectionName(event.target.value)} /><small className={fieldHelp}>Choose the create option, enter a new name, then save. All current details will be copied.</small></label>
      <label className={fieldLabel}>Semester starts<DateInput value={config.semesterStart} onChange={(value) => update({ semesterStart: value })} /></label>
      <label className={fieldLabel}>Semester ends<DateInput value={config.semesterEnd} onChange={(value) => update({ semesterEnd: value })} /></label>
      <SectionManager sections={sections} selectedSectionId={selectedSectionId} />
    </div>
    <input type="hidden" name="sectionName" value={sectionName} /><input type="hidden" name="config" value={JSON.stringify(config)} /><input type="hidden" name="updatedAt" value={updatedAt ?? ''} />
    <section className="grid gap-4 pt-[22px] border-t-[3px] border-dotted border-red">
      <div className={adminHeading}><div><p className="eyebrow-text mb-[7px] text-[10px] text-muted">Weekly timetable</p><h2 className={adminH2}>Periods by weekday</h2></div><div className="flex items-start gap-[18px] phone:flex-wrap"><div className="grid shrink-0 justify-items-center gap-0.5"><strong className="font-display text-[25px] leading-none font-black text-teal">{config.timetable.length}</strong><span className="whitespace-nowrap font-term text-[10px] text-muted">regular / week</span></div><div className="grid shrink-0 justify-items-center gap-0.5"><strong className="font-display text-[25px] leading-none font-black text-teal">{semesterPeriodCount}</strong><span className="whitespace-nowrap font-term text-[10px] text-muted">periods this semester</span></div></div></div>
      {days.map(([weekday, label]) => <div className="grid gap-2" key={weekday}><div className="flex items-center justify-between text-[14px]"><strong>{label}</strong><button className={adminButton} type="button" onClick={() => addPeriod(weekday)}>+ period</button></div>{config.timetable.map((period, index) => period.weekday === weekday && <div className="grid grid-cols-[24px_minmax(0,1fr)_12px_minmax(0,1fr)_22px_22px_25px] items-center gap-1" key={`${weekday}-${index}`} draggable onDragStart={() => setDraggedPeriod(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedPeriod !== null) movePeriod(draggedPeriod, index); setDraggedPeriod(null); }}><span className="font-term text-[11px] text-muted">#{period.sequence}</span><input className={`${adminInput} min-h-11`} aria-label={`${label} period start`} type="time" value={period.start} onChange={(event) => updatePeriod(index, { start: event.target.value })} /><span className="text-center">→</span><input className={`${adminInput} min-h-11`} aria-label={`${label} period end`} type="time" value={period.end} onChange={(event) => updatePeriod(index, { end: event.target.value })} /><button className={`${adminButton} !p-0 text-center text-[16px]`} type="button" aria-label={`Move ${label} period up`} onClick={() => movePeriod(index, index - 1)}>↑</button><button className={`${adminButton} !p-0 text-center text-[16px]`} type="button" aria-label={`Move ${label} period down`} onClick={() => movePeriod(index, index + 1)}>↓</button><button className={`${adminButton} !p-0 text-center text-[16px]`} type="button" aria-label={`Remove ${label} period`} onClick={() => removePeriod(index)}>×</button></div>)}</div>)}
    </section>
    <ConfigList title="Exams" actionLabel="+ exam" onAdd={addCustomExam}>{config.exams.map((exam) => <div className="grid gap-2.5" key={exam.name}><div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_34px] items-center gap-2 phone:grid-cols-1"><input className={`${adminInput} min-h-11 self-center`} aria-label="Exam name" value={exam.name} onChange={(event) => updateExam(exam.name, { name: event.target.value })} placeholder="Exam name" maxLength={80} /><div className="min-w-0"><DateInput ariaLabel={`${exam.name} start`} value={exam.start} onChange={(value) => updateExam(exam.name, { start: value })} /></div><div className="min-w-0"><DateInput ariaLabel={`${exam.name} end`} value={exam.end} onChange={(value) => updateExam(exam.name, { end: value })} /></div><select className={`${adminInput} phone:w-full`} aria-label={`${exam.name} default periods per day`} value={exam.periodsPerDay} onChange={(event) => updateExam(exam.name, { periodsPerDay: Number(event.target.value) as 2 | 4 })}><option value="2">2 periods/day</option><option value="4">4 periods/day</option></select><button className={`${removeButton} phone:justify-self-end`} type="button" aria-label={`Remove ${exam.name}`} onClick={() => removeExam(exam.name)}>×</button></div><small className={fieldHelp}>Use the default above, then override individual exam dates below.</small>{exam.dailyPeriods?.map((day, dayIndex) => <div className="grid max-w-[330px] grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_28px] items-center gap-1.5 phone:max-w-full" key={`${exam.name}-${dayIndex}`}><DateInput ariaLabel={`${exam.name} override date`} value={day.date} onChange={(value) => updateExam(exam.name, { dailyPeriods: exam.dailyPeriods?.map((entry, entryIndex) => entryIndex === dayIndex ? { ...entry, date: value } : entry) })} /><select className={adminInput} aria-label={`${exam.name} override periods`} value={day.periodsPerDay} onChange={(event) => updateExam(exam.name, { dailyPeriods: exam.dailyPeriods?.map((entry, entryIndex) => entryIndex === dayIndex ? { ...entry, periodsPerDay: Number(event.target.value) as 2 | 4 } : entry) })}><option value="2">2 periods</option><option value="4">4 periods</option></select><button className={removeButton} type="button" aria-label={`Remove ${exam.name} daily override`} onClick={() => updateExam(exam.name, { dailyPeriods: exam.dailyPeriods?.filter((_, entryIndex) => entryIndex !== dayIndex) })}>×</button></div>)}<button className={adminButton} type="button" onClick={() => updateExam(exam.name, { dailyPeriods: [...(exam.dailyPeriods ?? []), { date: exam.start, periodsPerDay: exam.periodsPerDay }] })}>+ date override</button></div>)}</ConfigList>
    <ConfigList title="Universal holidays" actionLabel="+ holiday" onAdd={addHoliday}><p className={fieldHelp}>These holidays apply to every section.</p>{config.holidays.map((holiday, index) => <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] items-center gap-1.5" key={index}><input className={adminInput} aria-label="Holiday name" value={holiday.name} onChange={(event) => update({ holidays: config.holidays.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /><DateInput ariaLabel="Holiday start" value={holiday.start} onChange={(value) => update({ holidays: config.holidays.map((item, itemIndex) => itemIndex === index ? { ...item, start: value } : item) })} /><DateInput ariaLabel="Holiday end" value={holiday.end} onChange={(value) => update({ holidays: config.holidays.map((item, itemIndex) => itemIndex === index ? { ...item, end: value } : item) })} /><button className={removeButton} type="button" aria-label={`Remove ${holiday.name}`} onClick={() => removeHoliday(index)}>×</button></div>)}</ConfigList>
    <ConfigList title="Universal special Saturdays" actionLabel="+ Saturday" onAdd={addSaturday}><p className={fieldHelp}>These working Saturdays apply to every section.</p>{config.specialSaturdays.map((special, index) => <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] items-center gap-1.5" key={index}><DateInput ariaLabel="Special Saturday date" value={special.date} onChange={(value) => update({ specialSaturdays: config.specialSaturdays.map((item, itemIndex) => itemIndex === index ? { ...item, date: value } : item) })} /><select className={adminInput} aria-label="Copied weekday" value={special.copiedWeekday} onChange={(event) => update({ specialSaturdays: config.specialSaturdays.map((item, itemIndex) => itemIndex === index ? { ...item, copiedWeekday: Number(event.target.value) as Weekday } : item) })}><option value="1">Monday timetable</option><option value="2">Tuesday timetable</option><option value="3">Wednesday timetable</option><option value="4">Thursday timetable</option><option value="5">Friday timetable</option></select><button className={removeButton} type="button" aria-label="Remove special Saturday" onClick={() => removeSaturday(index)}>×</button></div>)}</ConfigList>
    {state.error && <p className="border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{state.error}</p>}{state.success && <p className="font-term text-[13px] font-bold text-success" role="status">{state.success}</p>}
    <SemesterCalendar config={config} />
  </form>;
}

const todayIso = currentIstDate(new Date());

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
  const blanks = firstDay; // Sunday-start
  const selectedIso = parsed ?? '';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

return <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch" ref={containerRef}>
<input className="min-w-0 w-full min-h-[54px] rounded-none border-2 border-black border-r-0 bg-surface px-2 py-2.5 font-sans text-[16px] text-black outline-none focus:border-orange" inputMode="numeric" placeholder="dd/mm/yyyy" aria-label={ariaLabel} value={text} onChange={(event) => setText(event.target.value)} onBlur={() => { const p = parseDisplayDate(text); if (p) { setText(formatDisplayDate(p)); onChange(p); } }} />
    <button type="button" className="grid w-[38px] place-items-center border-2 border-black bg-surface text-muted cursor-pointer transition-[background,color] hover:bg-orange hover:text-white" aria-label="Open calendar" onClick={toggleCalendar}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
    {open && <div className="absolute top-full left-0 z-50 mt-1.5 min-w-[250px] border-[3px] border-black bg-paper p-2.5 shadow-hard animate-calendar-pop">
      <div className="mb-2 flex items-center justify-between">
        <button className="size-7 border-2 border-black bg-surface text-[16px] font-bold text-black cursor-pointer hover:bg-orange hover:text-white" type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month">‹</button>
        <span className="font-term text-[12px] font-bold text-black">{monthNames[viewMonth]} {viewYear}</span>
        <button className="size-7 border-2 border-black bg-surface text-[16px] font-bold text-black cursor-pointer hover:bg-orange hover:text-white" type="button" onClick={() => navigateMonth(1)} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d} className="py-1 text-center font-term text-[9px] font-bold uppercase text-muted">{d}</span>)}
        {Array.from({ length: blanks }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          return <button type="button" key={day} className={`size-8 border-0 font-sans text-[12px] font-medium text-black cursor-pointer transition-colors hover:bg-surface ${isSelected ? 'bg-black text-lime' : 'bg-transparent'} ${isToday ? 'outline outline-2 outline-today' : ''}`} onClick={() => pickDate(day)}>{day}</button>;
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
  return <section className={configSection}><div className={adminHeading}><div><p className="eyebrow-text mb-[7px] text-[10px] text-muted">Calendar exceptions</p><h2 className={adminH2}>{title}</h2></div><button className={adminButton} type="button" onClick={onAdd}>{actionLabel}</button></div>{children}</section>;
}

function SectionManager({ sections, selectedSectionId }: { sections: SectionOption[]; selectedSectionId: string }) {
  const router = useRouter();
  const [renameState, renameAction, renamePending] = useActionState(renameSection, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSection, {});
  useEffect(() => { router.refresh(); }, [router, renameState.success, deleteState.success]);
  if (sections.length === 0) return null;

  return <div className="grid gap-3.5">
    <form className="grid max-w-none gap-3.5 phone:grid-cols-2 phone:items-end phone:gap-2.5" action={renameAction}>
      <label className={fieldLabel}>
        Rename section
        <select className="border-2 border-black bg-surface p-2.5 font-sans text-[13px] text-black outline-none focus:border-orange" name="sectionId" defaultValue={selectedSectionId || ''} required>
          {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </label>
      <label className={fieldLabel}>
        New name
        <input className={adminInput} name="newName" required maxLength={80} placeholder="e.g. CSE 6" />
      </label>
      <button className="min-h-11 justify-self-start border-[3px] border-black bg-orange px-4 py-2.5 font-term text-[12px] font-black uppercase text-white cursor-pointer shadow-[2px_2px_0_var(--shadow-color)] disabled:cursor-wait disabled:opacity-65" type="submit" disabled={renamePending}>{renamePending ? 'Renaming...' : 'Rename'}</button>
      {renameState.error && <p className="border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{renameState.error}</p>}
    </form>
    <form className="grid max-w-none gap-2.5 border-t border-line pt-3.5 phone:grid-cols-[minmax(0,1fr)_auto] phone:items-center" action={deleteAction} onSubmit={(event) => {
      if (!confirm('Delete this section? Its timetable, exams and semester dates are removed permanently. Holidays shared by all sections are kept.')) event.preventDefault();
    }}>
      <input type="hidden" name="sectionId" value={selectedSectionId || ''} />
      <p className={fieldHelp}>Deletes “{sections.find((section) => section.id === selectedSectionId)?.name ?? selectedSectionId}” — the section currently open above. This cannot be undone.</p>
      <button type="submit" className={`${removeButton} h-auto min-h-11 w-auto min-w-[120px] justify-self-start px-4 py-2.5 !text-[12px] disabled:cursor-wait disabled:opacity-65 phone:justify-self-end`} disabled={deletePending || !selectedSectionId}>{deletePending ? 'Deleting...' : 'Delete current section'}</button>
      {deleteState.error && <p className="border-2 border-black bg-danger-bg p-2 font-term text-[11px] leading-[1.3] font-bold text-error" role="alert">{deleteState.error}</p>}
    </form>
  </div>;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function SemesterCalendar({ config }: { config: ScheduleConfig }) {
  const startDate = new Date(`${config.semesterStart}T00:00:00Z`);
  const endDate = new Date(`${config.semesterEnd}T00:00:00Z`);
  const startMonth = startDate.getUTCMonth();
  const startYear = startDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endYear = endDate.getUTCFullYear();

  const months: { year: number; month: number }[] = [];
  for (let y = startYear, m = startMonth; y < endYear || (y === endYear && m <= endMonth); m++) {
    if (m > 11) { m = 0; y++; }
    months.push({ year: y, month: m });
  }

  let totalPeriods = 0;

  const monthGrids = months.map(({ year, month }) => {
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const blanks = firstDay; // Sunday-start

    const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const inSemester = iso >= config.semesterStart && iso <= config.semesterEnd;
      const periods = inSemester ? periodsForDate(config, iso) : [];
      const count = periods.length;
      if (inSemester) totalPeriods += count;
      const isHoliday = inSemester && config.holidays.some((h) => dateInRange(iso, h.start, h.end));
      const isExam = inSemester && config.exams.some((e) => dateInRange(iso, e.start, e.end));
      const isSpecialSaturday = inSemester && config.specialSaturdays.some((s) => s.date === iso);
      const isToday = iso === todayIso;

      let className = 'relative flex h-[38px] flex-col items-center justify-center border-2 text-[12px] transition-transform hover:-translate-y-px';
      if (!inSemester || count === 0 && !isHoliday && !isExam && !isSpecialSaturday) className += ' border-transparent bg-transparent text-muted opacity-40';
      else if (isHoliday) className += ' bg-holiday-bg border-holiday-border text-holiday-ink';
      else if (isExam) className += ' bg-exam-bg border-exam-border text-exam-ink';
      else if (isSpecialSaturday) className += ' bg-special-bg border-special-border text-special-ink';
      else className += ' bg-cal-cell border-cal-cell-border text-black';
      if (isToday) className += ' !border-today font-extrabold';

      let title = `${iso}: ${count} period${count !== 1 ? 's' : ''}`;
      if (isHoliday) { const holiday = config.holidays.find((h) => dateInRange(iso, h.start, h.end)); title += ` — ${holiday?.name ?? 'Holiday'}`; }
      else if (isExam) { const exam = config.exams.find((e) => dateInRange(iso, e.start, e.end)); title += ` — ${exam?.name ?? 'Exam'}`; }
      else if (isSpecialSaturday) { title += ' — Working Saturday'; }

      return { day, iso, count, className, title, isHoliday, isExam, isSpecialSaturday, inSemester };
    });

    return { year, month, blanks, dayCells };
  });

  return <section className={configSection}>
    <div className={adminHeading}>
      <div><p className="eyebrow-text mb-[7px] text-[10px] text-teal">Semester overview</p><h2 className={adminH2}>Period calendar</h2></div>
<div className="grid shrink-0 justify-items-center gap-0.5"><strong className="font-display text-[25px] leading-none font-black text-teal">{totalPeriods}</strong><span className="whitespace-nowrap font-term text-[10px] text-muted">total periods</span></div>
    </div>
    {monthGrids.map(({ year, month, blanks, dayCells }) => <div className="mt-5 border-[3px] border-black bg-surface p-5 shadow-hard" key={`${year}-${month}`}>
      <div className="mb-3 font-term text-[13px] leading-[1.2] font-extrabold uppercase tracking-[.5px] text-teal">{MONTH_NAMES[month]} {year}</div>
      <div className="grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d} className="py-1 text-center font-term text-[9px] font-bold uppercase text-muted">{d}</span>)}
        {Array.from({ length: blanks }).map((_, i) => <span key={`b${i}`} />)}
        {dayCells.map(({ day, className, title, count, isHoliday, isExam, isSpecialSaturday, inSemester }) => <div key={day} className={className} title={title}>
          <span className="text-[11px] leading-none font-bold">{day}</span>
          {inSemester && count > 0 && <span className="mt-0.5 font-term text-[9px] leading-none font-bold opacity-70">{count}</span>}
          {isHoliday && <span className="mt-0.5 block size-[5px] rounded-full bg-holiday-ink" />}
          {isExam && <span className="mt-0.5 block size-[5px] rounded-full bg-exam-ink" />}
          {isSpecialSaturday && !isHoliday && !isExam && <span className="mt-0.5 block size-[5px] rounded-full bg-special-ink" />}
        </div>)}
      </div>
    </div>)}
    <div className="mt-4 flex justify-center gap-4 text-[11px] font-bold text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-holiday-ink" /> Holiday</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-exam-ink" /> Exam</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block size-[5px] rounded-full bg-special-ink" /> Working Sat</span>
    </div>
  </section>;
}
