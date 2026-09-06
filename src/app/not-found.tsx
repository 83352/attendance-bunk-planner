import Link from 'next/link';
import { SiteHeader } from './SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-47px)] w-full max-w-[680px] items-center px-5 py-10 phone:px-3">
        <section className="w-full border-[3px] border-black bg-paper p-6 shadow-hard">
          <p className="eyebrow-text mb-2 text-[10px] text-black">404</p>
          <h1 className="m-0 font-display text-[32px] leading-none font-black uppercase">Page not found</h1>
          <p className="mt-3 font-term text-[13px] leading-[1.5] text-muted">That page doesn&rsquo;t exist. Check the link, or head back to the attendance desk.</p>
          <Link className="btn-calculate btn-calculate-hover mt-5" href="/">Back to dontbunk <span aria-hidden="true">↗</span></Link>
        </section>
      </main>
    </>
  );
}
