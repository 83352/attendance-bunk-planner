'use client';

import { useEffect, useRef } from 'react';

/**
 * Blocks the whole site when the portal stops answering the way dontbunk
 * expects. A native modal dialog: the page behind it is inert, and it can't be
 * dismissed (no close button, and Escape or any other close reopens it).
 */
export function MaintenanceNotice() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    // Browsers that support it ignore Escape and other close requests outright.
    element.setAttribute('closedby', 'none');
    if (!element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="maintenance-title"
      aria-describedby="maintenance-body"
      onCancel={(event) => event.preventDefault()}
      // Escape can't always be stopped (browsers allow it before the visitor has interacted), so a close just reopens it.
      onClose={(event) => event.currentTarget.showModal()}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[var(--ui-radius)] border-[length:var(--ui-border)] border-edge bg-paper p-0 text-black shadow-hard backdrop:bg-black/80"
    >
      <div role="alert" className="grid gap-3 p-5 text-[15px] leading-[1.55] phone:p-6">
        <p className="eyebrow-text m-0 text-[12px] text-teal">Under maintenance</p>
        <h1 id="maintenance-title" className="heading m-0 text-[24px] leading-[1.05]">dontbunk is being fixed</h1>
        <p id="maintenance-body" className="m-0">
          CampX has changed something, so dontbunk can&rsquo;t show a number you can trust right now. Rather than show you a wrong one, it&rsquo;s switched off until it&rsquo;s fixed.
        </p>
        <p className="m-0 text-muted">Check your attendance on CampX in the meantime, and try dontbunk again later.</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-calculate btn-calculate-hover">Try again</button>
      </div>
    </dialog>
  );
}
