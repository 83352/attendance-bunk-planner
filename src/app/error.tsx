'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[680px] items-center px-5 py-10 phone:px-3">
      <section className="w-full border-[3px] border-black bg-paper p-6 shadow-hard">
        <p className="eyebrow-text mb-2 text-[10px] text-black">Temporary problem</p>
        <h1 className="m-0 font-display text-[32px] leading-none font-black uppercase">Schedule unavailable</h1>
        <p className="mt-3 font-term text-[13px] leading-[1.5] text-muted">The schedule could not be loaded right now. Try again in a moment.</p>
        <button className="btn-calculate btn-calculate-hover mt-5" type="button" onClick={reset}>Try again <span aria-hidden="true">↗</span></button>
      </section>
    </main>
  );
}