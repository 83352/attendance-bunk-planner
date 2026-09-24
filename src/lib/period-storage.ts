

const STORAGE_PREFIX = 'dontbunk:adjustments:';

type StoredAdjustments = {
  /** IST date when these were saved (YYYY-MM-DD). Used for midnight expiry. */
  date: string;
  /** Calendar overrides: "date:sequence" -> 'attended' | 'bunked'. */
  overrides: Record<string, 'attended' | 'bunked'>;
  /** Today's period input: sequence (as string) -> attending (boolean). */
  todayInput: Record<string, boolean>;
};

function storageKey(sectionId: string): string {
  return `${STORAGE_PREFIX}${sectionId}`;
}

export function loadAdjustments(
  sectionId: string,
  todayIst: string,
): { overrides: Map<string, 'attended' | 'bunked'>; todayInput: Map<number, boolean> } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(sectionId));
    if (!raw) return null;
    const stored: StoredAdjustments = JSON.parse(raw);
    const overrides = new Map(Object.entries(stored.overrides || {})) as Map<string, 'attended' | 'bunked'>;
    const todayInput = new Map<number, boolean>();

    if (stored.date === todayIst) {
      for (const [k, v] of Object.entries(stored.todayInput || {})) {
        todayInput.set(Number(k), v);
      }
    } else {
      // The day has changed. Convert the old 'today' inputs into absolute calendar overrides.
      for (const [seqStr, attending] of Object.entries(stored.todayInput || {})) {
        const key = `${stored.date}:${seqStr}`;
        if (!overrides.has(key)) {
          overrides.set(key, attending ? 'attended' : 'bunked');
        }
      }
    }

    return { overrides, todayInput };
  } catch {
    return null;
  }
}

export function saveAdjustments(
  sectionId: string,
  todayIst: string,
  overrides: Map<string, 'attended' | 'bunked'>,
  todayInput: Map<number, boolean>,
): void {
  try {
    const stored: StoredAdjustments = {
      date: todayIst,
      overrides: Object.fromEntries(overrides),
      todayInput: Object.fromEntries(todayInput),
    };
    window.localStorage.setItem(storageKey(sectionId), JSON.stringify(stored));
  } catch {
    // Ignore — e.g. private browsing with storage disabled.
  }
}

export function clearAdjustments(sectionId: string): void {
  try {
    window.localStorage.removeItem(storageKey(sectionId));
  } catch {
    // Ignore.
  }
}
