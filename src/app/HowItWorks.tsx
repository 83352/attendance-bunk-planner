'use client';

import { useRef } from 'react';

/**
 * Header button + popup explaining how the numbers are produced. Lives in the
 * header so the answer card stays clean while the "this is an estimate" caveat
 * is still one tap away.
 */
export function HowItWorks() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="absolute top-1/2 right-3 inline-flex min-h-11 -translate-y-1/2 cursor-pointer items-center gap-1.5 px-2 font-term text-[11px] font-bold text-[#f5f2e9] hover:text-[#b7f14a] phone:right-[18px]"
      >
        <span aria-hidden="true">ⓘ</span> How it works
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="how-it-works-title"
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        className="m-auto w-[calc(100%-24px)] max-w-[440px] max-h-[85vh] overflow-y-auto border-[3px] border-black bg-paper p-6 shadow-hard backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-pop"
      >
        <h2 id="how-it-works-title" className="m-0 mb-4 font-display text-[22px] leading-none font-black uppercase">How it works</h2>
        <p className="m-0 mb-3 font-term text-[13px] leading-[1.4] font-bold text-black">This is an estimate. Always check your official portal before skipping.</p>
        <p className="m-0 mb-3 border-2 border-black bg-warning-bg p-3 font-term text-[13px] leading-[1.4] text-black">
          <strong>The rule:</strong> final % = (periods attended + periods left − bunks) ÷ (periods held + periods left). Your bunk count is the largest number that keeps that at or above your target.
        </p>
        <ul className="m-0 grid list-disc gap-2 pl-5 font-term text-[13px] leading-[1.4] text-black">
          <li>It assumes you attend every other class. Skip more than the number shown and you finish below your target.</li>
          <li>Your current % is treated as covering every period held through yesterday. Tagging a period of today as Auto means your portal already counts it, so it is added to &ldquo;held so far&rdquo; without changing your %.</li>
          <li>Periods held and left come from your section&apos;s timetable and the semester calendar (holidays, exams and working Saturdays).</li>
          <li>&ldquo;Days you can miss&rdquo; skips your longest days first and ignores exam days. &ldquo;Bunks per week&rdquo; is your bunks divided by the regular teaching weeks left (exam weeks aren&apos;t counted).</li>
          <li>If the portal is behind, mark those periods on the calendar to correct the numbers. Corrections and today&apos;s tags last for the day you make them; plans for future days are kept.</li>
        </ul>
        <button type="button" onClick={() => dialogRef.current?.close()} className="mt-5 min-h-11 w-full cursor-pointer border-2 border-black bg-lime font-term text-[12px] font-bold text-[#14261c] shadow-[2px_2px_0_var(--shadow-color)] transition-all hover:translate-y-px hover:shadow-[1px_1px_0_var(--shadow-color)]">Got it!</button>
      </dialog>
    </>
  );
}
