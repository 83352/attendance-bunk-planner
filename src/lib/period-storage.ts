
const STORAGE_PREFIX = 'dontbunk:adjustments:';

type StoredAdjustments = {
  /** IST date when these were saved (YYYY-MM-DD). Used for midnight expiry. */
  date: string;
  /** Calendar overrides: "date:sequence" -> 'attended' | 'bunked'. */
  overrides: Record<string, 'attended' | 'bunked'>;
  /** Today's completed/ongoing period input: sequence (as string) -> boolean | 'auto'. */
  todayInput: Record<string, boolean | 'auto'>;
  /** Today's upcoming period input: sequence (as string) -> boolean. */
  upcomingInput?: Record<string, boolean>;
};

function storageKey(sectionId: string): string {
  return `${STORAGE_PREFIX}${sectionId}`;
}

export function loadAdjustments(
  sectionId: string,
  todayIst: string,
): { overrides: Map<string, 'attended' | 'bunked'>; todayInput: Map<number, boolean | 'auto'>; upcomingInput: Map<number, boolean> } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(sectionId));
    if (!raw) return null;
    const stored: StoredAdjustments = JSON.parse(raw);
    let overrides = new Map(Object.entries(stored.overrides || {})) as Map<string, 'attended' | 'bunked'>;
    const todayInput = new Map<number, boolean | 'auto'>();
    const upcomingInput = new Map<number, boolean>();

    if (stored.date === todayIst) {
      for (const [k, v] of Object.entries(stored.todayInput || {})) {
        todayInput.set(Number(k), v);
      }
      for (const [k, v] of Object.entries(stored.upcomingInput || {})) {
        upcomingInput.set(Number(k), v);
      }
    }
    if (stored.date !== todayIst) {
      // Day has changed: drop yesterday's today-inputs entirely.  The portal
      // percentage already reflects reality for past days, so no promotion to
      // calendar overrides is needed. The same goes for calendar corrections
      // and plans that are now today or earlier: the student types a fresh
      // portal % on each visit, so keeping them would count those periods twice.
      // Plans for days still ahead are kept.
      overrides = new Map([...overrides].filter(([key]) => key.split(':')[0] > todayIst));
    }

    return { overrides, todayInput, upcomingInput };
  } catch {
    return null;
  }
}

export function saveAdjustments(
  sectionId: string,
  todayIst: string,
  overrides: Map<string, 'attended' | 'bunked'>,
  todayInput: Map<number, boolean | 'auto'>,
  upcomingInput: Map<number, boolean>,
): void {
  try {
    const stored: StoredAdjustments = {
      date: todayIst,
      overrides: Object.fromEntries(overrides),
      todayInput: Object.fromEntries(todayInput),
      upcomingInput: Object.fromEntries(upcomingInput),
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
