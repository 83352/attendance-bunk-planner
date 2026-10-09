'use client';

import { useEffect, useRef, useState } from 'react';
import { PeriodToggles, type ThreeStateValue } from './PeriodToggles';
import type { DatedPeriod } from '@/domain/schedule/types';
import { SECTION_COOKIE, SECTION_PICKED_EVENT } from '@/lib/section-cookie';

const CURRENT_VERSION = 'v2.2.0';
const STORAGE_KEY = 'dontbunk:lastSeenVersion';

const dummyPastPeriod: DatedPeriod[] = [
  { sequence: 1, start: '09:10', end: '10:10', weekday: 1, date: '2026-10-07' }
];

const dummyFuturePeriod: DatedPeriod[] = [
  { sequence: 2, start: '11:10', end: '12:10', weekday: 1, date: '2026-10-07' }
];

export function WhatsNewModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const [page, setPage] = useState(0);
  const [pastVal, setPastVal] = useState<ThreeStateValue>('auto');
  const [futureVal, setFutureVal] = useState<boolean>(true);

  // Show the tour once the student has picked a section, so it explains
  // controls they can actually see instead of hovering over a blank picker.
  useEffect(() => {
    const maybeShow = () => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === CURRENT_VERSION) return;
        if (!document.cookie.split('; ').some((entry) => entry.startsWith(`${SECTION_COOKIE}=`))) return;
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) window.setTimeout(() => { if (!dialog.open) dialog.showModal(); }, 600);
      } catch {
        // Ignore
      }
    };
    maybeShow();
    window.addEventListener(SECTION_PICKED_EVENT, maybeShow);
    return () => window.removeEventListener(SECTION_PICKED_EVENT, maybeShow);
  }, []);

  const handleClose = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      // Ignore
    }
    dialogRef.current?.close();
  };

  return (
    <dialog 
      ref={dialogRef}
      onCancel={handleClose}
      className="m-auto w-[calc(100%-24px)] max-w-[480px] max-h-[85vh] overflow-y-auto border-[3px] border-black bg-paper p-6 shadow-hard backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-pop"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-[26px] leading-none font-black uppercase">Quick tour</h2>
        <span className="font-term text-[12px] font-bold text-muted">{page + 1} / 3</span>
      </div>
      
      <div className="min-h-[220px] font-term text-[12px] leading-[1.4] text-black">
        {page === 0 && (
          <section className="animate-rise">
            <strong className="block font-bold mb-3 text-[16px]">Today&apos;s Classes</strong>
            <p className="opacity-80 mb-3">Tag today&apos;s classes. For finished periods, pick Auto if your portal already counts it, or Attended / Bunked if it doesn&apos;t yet:</p>
            <div className="pointer-events-auto">
              <PeriodToggles
                periods={dummyPastPeriod}
                mode="three-state"
                isPast={true}
                values={new Map([[1, pastVal]])}
                onChange={(_, v) => setPastVal(v as ThreeStateValue)}
              />
            </div>
            <p className="opacity-80 mt-5 mb-3">For upcoming periods, decide your plan:</p>
            <div className="pointer-events-auto">
              <PeriodToggles
                periods={dummyFuturePeriod}
                mode="two-state"
                fillRow
                isPast={false}
                values={new Map([[2, futureVal]])}
                onChange={(_, v) => setFutureVal(v as boolean)}
              />
            </div>
          </section>
        )}

        {page === 1 && (
          <section className="animate-rise">
            <strong className="block font-bold mb-3 text-[16px]">Planning Future Bunks</strong>
            <p className="opacity-80 mb-4 text-[13px]">Open <strong>Sem Calendar</strong> below and <strong>tap any future day</strong>.</p>
            
            <div className="my-6 flex items-center justify-center gap-6 px-2">
              <div className="relative flex h-[42px] w-[38px] flex-col items-center justify-center border-2 border-black bg-surface shadow-[2px_2px_0_var(--shadow-color)]">
                <span className="text-[12px] font-bold">15</span>
                <span className="mt-0.5 font-term text-[12px] font-bold tracking-tighter text-muted">5 p.</span>
              </div>
              <span className="text-[20px]">➡️</span>
              <div className="relative flex h-[44px] w-[48px] flex-col items-center justify-center border-2 border-adjusted bg-adjusted/10 text-adjusted">
                <span className="text-[12px] font-bold">15</span>
                <span className="mt-0.5 font-term text-[12px] font-bold leading-none">−5 p.</span>
              </div>
            </div>

            <p className="opacity-80 m-0 text-[13px]">Mark a whole day or single periods as skipped. Planned days turn blue, like the one above, and the numbers update.</p>
          </section>
        )}

        {page === 2 && (
          <section className="animate-rise">
            <strong className="block font-bold mb-3 text-[16px]">Correct your numbers</strong>
            <p className="opacity-80 mb-4 text-[13px]">Teachers forget to update attendance. Don&apos;t let it ruin your calculations.</p>
            
            <div className="my-6 flex items-center justify-center gap-6 px-2">
              <div className="relative flex h-[42px] w-[38px] flex-col items-center justify-center border-2 border-black bg-surface opacity-60 shadow-[2px_2px_0_var(--shadow-color)]">
                <span className="text-[12px] font-bold">12</span>
                <span className="mt-0.5 font-term text-[12px] font-bold tracking-tighter text-muted">4 p.</span>
              </div>
              <span className="text-[20px]">➡️</span>
              <div className="relative flex h-[42px] w-[38px] flex-col items-center justify-center border-2 border-lime bg-surface shadow-[2px_2px_0_var(--shadow-color)]">
                <span className="text-[12px] font-bold">12</span>
                <span className="mt-0.5 font-term text-[12px] font-bold tracking-tighter text-black">4 p.</span>
                <span className="absolute top-1 right-1 size-[5px] rounded-full bg-adjusted" />
              </div>
            </div>

            <p className="opacity-80 m-0 text-[13px]"><strong>Tap any past day</strong> in Sem Calendar to fix periods your portal hasn&apos;t counted yet. We&apos;ll work out your true percentage even if the portal is behind.</p>
          </section>
        )}
      </div>

      <div className="mt-6 grid grid-cols-[1fr_2fr] gap-3">
        {page > 0 ? (
          <button 
            type="button" 
            onClick={() => setPage((p) => p - 1)} 
            className="border-2 border-black bg-surface py-3 font-term text-[12px] font-bold text-black shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        <button 
          type="button" 
          onClick={() => {
            if (page < 2) setPage((p) => p + 1);
            else handleClose();
          }} 
          className="border-2 border-black bg-lime py-3 font-term text-[12px] font-bold text-[#14261c] shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]"
        >
          {page < 2 ? 'Next' : 'Got it!'}
        </button>
      </div>
    </dialog>
  );
}
