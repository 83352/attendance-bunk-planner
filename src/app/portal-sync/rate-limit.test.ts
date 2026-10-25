import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  const minute = 60_000;

  it('allows attempts until the limit is reached, then says how long to wait', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 10 * minute });
    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfter('a', i * minute)).toBe(0);
      limiter.fail('a', i * minute);
    }
    expect(limiter.retryAfter('a', 3 * minute)).toBe(7 * 60);
  });

  it('lets a key try again once its failures age out of the window', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: minute });
    limiter.fail('a', 0);
    expect(limiter.retryAfter('a', 30_000)).toBeGreaterThan(0);
    expect(limiter.retryAfter('a', minute)).toBe(0);
  });

  it('counts keys separately and clears on success', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: minute });
    limiter.fail('a', 0);
    expect(limiter.retryAfter('b', 0)).toBe(0);
    limiter.clear('a');
    expect(limiter.retryAfter('a', 0)).toBe(0);
  });
});
