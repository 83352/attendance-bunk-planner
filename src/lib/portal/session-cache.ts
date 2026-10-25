import { createHash } from 'node:crypto';
import type { PortalSession } from './campx-client';

/**
 * A small in-memory cache of promises with a time limit, for portal answers.
 * Promises rather than values, so two requests for the same thing at once share
 * one portal call. A failed promise is dropped straight away, so failures are
 * never served from the cache. Lives in one server instance's memory: a cold
 * start or another instance simply misses.
 */
export type SessionCache<T> = {
  get(key: string, load: () => Promise<T>, now?: number): Promise<T>;
  delete(prefix: string): void;
};

export function createSessionCache<T>({ ttlMs, maxEntries }: { ttlMs: number; maxEntries: number }): SessionCache<T> {
  const entries = new Map<string, { expires: number; value: Promise<T> }>();
  return {
    get(key, load, now = Date.now()) {
      const hit = entries.get(key);
      if (hit && hit.expires > now) return hit.value;
      entries.delete(key);
      const value = load();
      entries.set(key, { expires: now + ttlMs, value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      // Oldest first: Map keeps insertion order.
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
      return value;
    },
    delete(prefix) {
      for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
    },
  };
}

/** Identifies a signed-in session without keeping its token as a key. A new sign-in is a new session, so it never sees older cached data. */
export function sessionKey(session: PortalSession): string {
  return createHash('sha256').update(`${session.cookie}\n${session.bearer ?? ''}`).digest('hex');
}
