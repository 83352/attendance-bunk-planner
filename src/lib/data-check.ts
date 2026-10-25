/**
 * The "Data check" panel and the per-call timings under a sync error are for
 * debugging against the portal, not for students. Hidden unless the deploy sets
 * NEXT_PUBLIC_SHOW_DATA_CHECK=1.
 */
export const SHOW_DATA_CHECK = process.env.NEXT_PUBLIC_SHOW_DATA_CHECK === '1';
