/** Skeleton of the real page (header, title, result card, calendar) so a signed-in load feels instant instead of showing a bare message. */
export default function Loading() {
  return (
    <>
      <div className="min-h-[47px] bg-header-bg phone:min-h-[52px]" />
      <main className="mx-auto w-full max-w-[680px] px-4 py-6 phone:px-5 phone:py-8" aria-busy="true" aria-label="Loading">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-44" />
          </div>
          <div className="card grid gap-3 p-5">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-20 w-28" />
            <div className="skeleton h-4 w-3/4" />
          </div>
          <div className="card grid gap-3 p-5">
            <div className="skeleton h-5 w-40" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }, (_, index) => <div key={index} className="skeleton h-[38px]" />)}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
