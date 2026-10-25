import { describe, expect, it, vi } from 'vitest';
import { createSessionCache, sessionKey } from './session-cache';

describe('createSessionCache', () => {
  it('serves the same answer within the time limit, then loads again', async () => {
    const cache = createSessionCache<number>({ ttlMs: 1000, maxEntries: 10 });
    const load = vi.fn(async () => 7);
    expect(await cache.get('a', load, 0)).toBe(7);
    expect(await cache.get('a', load, 999)).toBe(7);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get('a', load, 1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one load between callers that ask at the same time', async () => {
    const cache = createSessionCache<number>({ ttlMs: 1000, maxEntries: 10 });
    const load = vi.fn(() => new Promise<number>((resolve) => setTimeout(() => resolve(1), 5)));
    const [first, second] = await Promise.all([cache.get('a', load, 0), cache.get('a', load, 1)]);
    expect([first, second]).toEqual([1, 1]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never keeps a failure', async () => {
    const cache = createSessionCache<number>({ ttlMs: 1000, maxEntries: 10 });
    await expect(cache.get('a', async () => { throw new Error('portal down'); }, 0)).rejects.toThrow('portal down');
    expect(await cache.get('a', async () => 2, 1)).toBe(2);
  });

  it('keeps keys apart, drops the oldest past the size limit, and forgets by prefix', async () => {
    const cache = createSessionCache<string>({ ttlMs: 1000, maxEntries: 2 });
    await cache.get('a|3', async () => 'a', 0);
    await cache.get('b', async () => 'b', 0);
    await cache.get('c', async () => 'c', 0);
    const reload = vi.fn(async () => 'fresh');
    expect(await cache.get('a|3', reload, 1)).toBe('fresh');
    expect(await cache.get('c', reload, 1)).toBe('c');
    cache.delete('a');
    expect(await cache.get('a|3', async () => 'after delete', 2)).toBe('after delete');
  });
});

describe('sessionKey', () => {
  it('is stable for a session, differs between sessions, and does not contain the token', () => {
    const one = { cookie: 'sid=1', bearer: 'secret-token' };
    expect(sessionKey(one)).toBe(sessionKey({ ...one }));
    expect(sessionKey(one)).not.toBe(sessionKey({ cookie: 'sid=2', bearer: 'secret-token' }));
    expect(sessionKey(one)).not.toContain('secret-token');
  });
});
