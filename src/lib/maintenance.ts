/**
 * Site-wide maintenance switch, read on the server. While it's on, every page
 * shows the under-maintenance notice instead of its content and sign-in is
 * refused, so nothing reaches the portal.
 *
 * On by default for now. MAINTENANCE_MODE=off in a deployment's environment lets
 * that deployment through anyway (e.g. Vercel previews, for testing);
 * MAINTENANCE_MODE=on forces it on. Env changes apply on the next deploy.
 */
const ON_BY_DEFAULT = false;

export const SITE_UNDER_MAINTENANCE = process.env.MAINTENANCE_MODE === 'on' || (ON_BY_DEFAULT && process.env.MAINTENANCE_MODE !== 'off');
