'use client';

import { useId, useRef } from 'react';

/** "ⓘ What do these buttons mean?" trigger plus its popup, shared by every panel that has Auto / Attended / Bunked buttons. */
export function PeriodHelp({ withoutAuto = false }: { /** Past calendar days have no Auto button: explain Attended/Bunked and say to leave it alone when the portal already has it. */ withoutAuto?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 cursor-pointer items-center justify-start gap-1.5 text-left font-term text-[12px] font-bold text-black underline decoration-dotted underline-offset-2"
      >
        <span aria-hidden="true">ⓘ</span> What do these buttons mean?
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        className="m-auto w-[calc(100%-24px)] max-w-[440px] max-h-[85vh] overflow-y-auto border-[3px] border-black bg-paper p-6 shadow-hard backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-pop"
      >
        <h2 id={titleId} className="m-0 mb-4 font-display text-[22px] leading-none font-black uppercase">What the buttons mean</h2>
        <dl className="m-0 grid gap-3 font-term text-[13px] leading-[1.4] text-black">
          {!withoutAuto && <div><dt className="font-black">Auto</dt><dd className="m-0">Already in your portal. Nothing to change.</dd></div>}
          <div><dt className="font-black">Attended</dt><dd className="m-0">You went, but the portal doesn&apos;t show it yet.</dd></div>
          <div><dt className="font-black">Bunked</dt><dd className="m-0">You skipped it, and the portal doesn&apos;t show it yet.</dd></div>
        </dl>
        {withoutAuto && <p className="m-0 mt-4 border-2 border-black bg-warning-bg p-3 font-term text-[12px] leading-[1.4] font-bold text-black">Note: don&apos;t select anything if it&apos;s already in your portal.</p>}
        <button type="button" onClick={() => dialogRef.current?.close()} className="mt-5 min-h-11 w-full cursor-pointer border-2 border-black bg-lime font-term text-[12px] font-bold text-[#14261c] shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]">Got it!</button>
      </dialog>
    </>
  );
}
