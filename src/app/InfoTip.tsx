'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Nudges an opened popover left (or right) so it never runs past the screen edge. */
function keepOnScreen(element: HTMLElement | null) {
  if (!element) return;
  element.style.transform = '';
  const { left, right } = element.getBoundingClientRect();
  const margin = 16;
  const overflowRight = right - (window.innerWidth - margin);
  if (overflowRight > 0) element.style.transform = `translateX(${-Math.min(overflowRight, left - margin)}px)`;
}

/**
 * A small "i" that opens a short explanation right where it's needed. Opens on
 * tap or Enter, closes on Esc, tapping elsewhere, or tapping it again.
 */
export function InfoTip({ label, anchor = 'self', children }: { label: string; /** 'field': span the nearest positioned ancestor's full width, below it (for form fields). 'self': open under the button and shift to stay on screen. */ anchor?: 'self' | 'field'; children: ReactNode }) {
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
    <span ref={root} className={`inline-flex align-middle ${anchor === 'self' ? 'relative' : ''}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        // Looks 16px but the tap area extends 10px past it on every side, so it stays easy to hit.
        className={`relative inline-grid size-4 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:text-link ${open ? 'text-link' : 'text-muted'}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" />
          <path d="M8 7.2v3.6" />
          <circle cx="8" cy="5.1" r=".35" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span
          id={id}
          role="note"
          ref={anchor === 'self' ? keepOnScreen : undefined}
          className={`absolute z-30 mt-2 block rounded-[var(--ui-radius-sm)] border border-edge bg-paper p-3 font-term text-[13px] leading-[1.5] font-normal normal-case tracking-normal text-black shadow-[var(--shadow-hard-md)] ${
            anchor === 'self' ? 'left-0 top-full w-[min(320px,calc(100vw-32px))]' : 'inset-x-0 top-full'
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
