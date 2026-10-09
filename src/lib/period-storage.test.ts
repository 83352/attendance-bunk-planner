import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAdjustments, saveAdjustments } from './period-storage';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('adjustment storage across days', () => {
  const overrides = new Map<string, 'attended' | 'bunked'>([
    ['2026-10-05:1', 'attended'], // a past correction
    ['2026-10-08:2', 'bunked'], // a plan for what is "today" by the next visit
    ['2026-10-12:1', 'bunked'], // a plan still ahead
  ]);
  const today = new Map<number, boolean | 'auto'>([[1, 'auto']]);

  it('keeps everything on the same day', () => {
    saveAdjustments('s', '2026-10-08', overrides, today, new Map());
    const loaded = loadAdjustments('s', '2026-10-08');
    expect(loaded?.overrides.size).toBe(3);
    expect(loaded?.todayInput.size).toBe(1);
  });

  it('drops past and now-today adjustments on a later day, keeping only plans still ahead', () => {
    saveAdjustments('s', '2026-10-08', overrides, today, new Map());
    const loaded = loadAdjustments('s', '2026-10-09');
    expect([...(loaded?.overrides.keys() ?? [])]).toEqual(['2026-10-12:1']);
    expect(loaded?.todayInput.size).toBe(0);
  });
});
