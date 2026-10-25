import { unstable_isUnrecognizedActionError } from 'next/navigation';

/**
 * What to tell a student when a call to the server fails on the way (not a
 * portal problem). After a deploy, a tab opened before it can't call the new
 * server's actions until it's reloaded; anything else is usually a dropped
 * connection.
 */
export function actionFailureMessage(error: unknown): string {
  return unstable_isUnrecognizedActionError(error)
    ? 'dontbunk was just updated. Reload the page, then try again.'
    : 'Something went wrong. Check your connection and try again.';
}

export const isStalePage = unstable_isUnrecognizedActionError;
