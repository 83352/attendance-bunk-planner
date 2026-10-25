'use client';

import { useRef } from 'react';
import { MadeBy } from './MadeBy';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What dontbunk does',
    body: [
      'It reads your attendance and timetable from the college portal (CampX) and tells you how many periods you can still bunk and finish the semester at 75%, the college minimum. It is a calculator on top of the portal; the portal itself is always the final word.',
    ],
  },
  {
    title: 'Signing in and your password',
    body: [
      'You sign in once with your roll number and CampX password. The password is sent over HTTPS through dontbunk’s server to CampX, only to get a sign-in token. It is never stored or logged.',
      'To keep you signed in, dontbunk keeps the portal’s sign-in token in a cookie on this device only. Every time you open the page it fetches fresh data. Log out revokes that token at the portal and removes the cookie and your saved answers from this device.',
      'Accounts with two-step verification (MFA) turned on aren’t supported yet.',
    ],
  },
  {
    title: 'Where the numbers come from',
    body: [
      'Periods held and attended are the portal’s own counts for your current semester. Periods still to come are read from your own timetable on the portal, so labs count as the number of periods they are worth.',
      'When your class splits into batches for labs, dontbunk keeps only the lab that belongs to your batch (found from the classes the portal has already marked for you).',
    ],
  },
  {
    title: 'Periods that aren’t marked yet',
    body: [
      'Teachers don’t always mark attendance straight away. If a period that already ended is still unmarked on the portal, dontbunk asks whether you attended it. Answering is required: your result stays locked until every one is answered, so the number is exact. After that the list folds into one line, and you can still change an answer. Answers are saved on this device and disappear once the portal marks the period.',
      'Classes that ended today appear in that list once they finish. Classes still to come today are not counted until tomorrow.',
    ],
  },
  {
    title: 'The bunk budget',
    body: [
      'Attending every remaining period raises your attendance; each period you bunk lowers it. The big number is how many periods you can bunk and still end the semester at or above 75%. The line under it is where you would land if you used all of them. A double period (like a lab) counts as 2.',
      'Below 75%, the big number becomes how many classes in a row you need to attend to get back to it.',
    ],
  },
  {
    title: 'Safe, Careful, Tight, Danger',
    body: [
      'Like everything else, this label is measured against 75%. Safe means you can bunk and stay above 75%. Careful means you are at the line or recovery is easy. Tight means recovering to 75% would take most of the classes left. Danger means 75% is nearly or fully out of reach.',
    ],
  },
  {
    title: 'Days you can miss',
    body: [
      'This is a range because it depends on which days you skip. Skipping your longest days first uses the budget fastest (the lower number); skipping your shortest days first stretches it (the higher number). Tap the i beside it to see your own longest and shortest days.',
    ],
  },
  {
    title: 'Exams, holidays and special Saturdays',
    body: [
      'Exam periods are compulsory. They count toward your percentage but are not counted in “periods left”, “days you can miss” or bunks per week.',
      'The portal can take a few days to show a holiday, a special Saturday or the next exam’s dates. dontbunk adds these from its own calendar until the portal catches up; once the portal shows them, the portal’s version is used. A “Heads up” note tells you when this has happened.',
    ],
  },
  {
    title: 'Reading the calendar',
    body: [
      'The number under a date is how many periods that day has. The mark in the corner is your attendance: a green tick means you attended every period, an amber half circle means you bunked at least one, and a red cross means you were absent all day. A dashed amber outline with a “?” means a class that day still needs your answer. Holidays, exam days and working Saturdays are tinted and labelled H, E and W. Tap a day to see each class; holidays show their name. “Today” jumps back to this month.',
    ],
  },
  {
    title: 'If a number looks wrong',
    body: [
      'Compare it with what CampX shows. If they differ, trust CampX.',
    ],
  },
];

/** Header button that opens a detailed, scrollable explanation of how the app works. */
export function HowItWorks() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--ui-radius-sm)] border border-header-ink/40 bg-transparent px-3 font-term text-[13px] font-bold text-header-ink"
      >
        <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-current text-[12px] leading-none">?</span>
        <span className="hidden min-[400px]:inline">How it works</span>
        <span className="sr-only min-[400px]:hidden">How it works</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="how-it-works-title"
        // Tapping the dimmed area outside the panel closes it, like Esc or the close button.
        onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
        className="m-auto max-h-[88vh] w-[min(640px,calc(100vw-24px))] overflow-y-auto rounded-[var(--ui-radius)] border-[length:var(--ui-border)] border-edge bg-paper p-0 text-black shadow-hard backdrop:bg-black/60"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-edge bg-paper px-5 py-4">
          <h2 id="how-it-works-title" className="heading m-0 text-[22px] leading-none">How it works</h2>
          <button type="button" onClick={() => dialog.current?.close()} className="chip" aria-label="Close how it works">Close</button>
        </div>
        <div className="grid gap-5 px-5 py-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="heading m-0 mb-1.5 text-[16px]">{section.title}</h3>
              <div className="grid gap-2 text-[15px] leading-[1.6] text-muted">
                {section.body.map((paragraph) => <p key={paragraph} className="m-0">{paragraph}</p>)}
              </div>
            </section>
          ))}
          <MadeBy />
        </div>
      </dialog>
    </>
  );
}
