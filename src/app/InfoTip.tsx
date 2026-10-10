'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A small "i" that opens a short explanation right where it's needed. Opens on
 * tap or Enter, closes on Esc, tapping elsewhere, or tapping it again.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="grid size-6 cursor-pointer place-items-center rounded-full border border-edge bg-surface font-sans text-[12px] leading-none font-bold text-link"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-full z-30 mt-2 block w-[min(300px,calc(100vw-48px))] rounded-[var(--ui-radius-sm)] border border-edge bg-paper p-3 font-term text-[13px] leading-[1.5] font-normal normal-case tracking-normal text-black shadow-[var(--shadow-hard-md)]"
        >
          {children}
        </span>
      )}
    </span>
  );
}
