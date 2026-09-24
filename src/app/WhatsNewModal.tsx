'use client';

import { useEffect, useState } from 'react';

const CURRENT_VERSION = 'v1.1.0';
const STORAGE_KEY = 'dontbunk:lastSeenVersion';

export function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = window.localStorage.getItem(STORAGE_KEY);
      if (lastSeen !== CURRENT_VERSION) {
        setIsOpen(true);
      }
    } catch {
      // Ignore if localStorage is disabled
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-rise">
      <div className="w-full max-w-[420px] border-[3px] border-black bg-paper p-6 shadow-hard [animation:var(--animate-calendar-pop)] phone:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[28px] leading-none font-black uppercase tracking-[.2px]">What&apos;s New!</h2>
          <span className="font-term text-[11px] font-bold text-muted">{CURRENT_VERSION}</span>
        </div>
        
        <ul className="mb-6 grid gap-4 font-term text-[12px] leading-[1.4] text-black">
          <li className="flex gap-2.5">
            <span className="text-lime text-[14px]" aria-hidden="true">■</span>
            <div>
              <strong className="block font-bold uppercase tracking-[.4px] mb-0.5">Future Planning</strong>
              <p className="opacity-80">Tap any future day on the calendar to mark specific periods as bunks or attended, and see your exact runway.</p>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className="text-lime text-[14px]" aria-hidden="true">■</span>
            <div>
              <strong className="block font-bold uppercase tracking-[.4px] mb-0.5">Past Adjustments</strong>
              <p className="opacity-80">Teachers haven&apos;t updated the portal? Tap past days to manually override periods to keep your % accurate.</p>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className="text-lime text-[14px]" aria-hidden="true">■</span>
            <div>
              <strong className="block font-bold uppercase tracking-[.4px] mb-0.5">Today&apos;s Classes</strong>
              <p className="opacity-80">A new widget tracks your completed and upcoming periods for today so you know exactly what&apos;s left.</p>
            </div>
          </li>
        </ul>

        <button 
          type="button" 
          onClick={handleClose} 
          className="w-full border-2 border-black bg-lime py-3 font-term text-[12px] font-bold uppercase tracking-[.4px] text-[#14261c] shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
