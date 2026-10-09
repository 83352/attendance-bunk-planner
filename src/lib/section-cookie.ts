/** Cookie remembering the last-picked section, readable on the server for a flash-free first paint. */
export const SECTION_COOKIE = 'dontbunk_section';

/** Fired on window when a section has just been picked, so the first-visit tour can wait for it. */
export const SECTION_PICKED_EVENT = 'dontbunk:section-picked';
