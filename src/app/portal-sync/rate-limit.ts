/**
 * Slows down password guessing through this site. Counts failed sign-ins per
 * key (roll number, client IP) in a sliding window and refuses further attempts
 * once a key hits its limit. State is in this server instance's memory: on a
 * serverless host each instance counts separately and a restart clears it, so
 * this is a speed bump, not a guarantee. CampX's own lockouts are the backstop.
 */
export type RateLimiter = {
  /** Seconds until `key` may try again, or 0 if it may try now. */
  retryAfter(key: string, now?: number): number;
  fail(key: string, now?: number): void;
  clear(key: string): void;
};

const MAX_KEYS = 5000;

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string, now: number): number[] => {
    const kept = (failures.get(key) ?? []).filter((at) => now - at < windowMs);
    if (kept.length > 0) failures.set(key, kept);
    else failures.delete(key);
    return kept;
  };

  return {
    retryAfter(key, now = Date.now()) {
      const kept = recent(key, now);
      return kept.length >= max ? Math.ceil((kept[0] + windowMs - now) / 1000) : 0;
    },
    fail(key, now = Date.now()) {
      if (failures.size >= MAX_KEYS && !failures.has(key)) failures.delete(failures.keys().next().value as string);
      failures.set(key, [...recent(key, now), now]);
    },
    clear(key) {
      failures.delete(key);
    },
  };
}
