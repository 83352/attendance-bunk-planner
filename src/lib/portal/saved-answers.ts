/**
 * The student's answers to "did you attend?" for periods the portal hasn't
 * graded yet, kept in this browser so they survive a reload or a return visit.
 * Keyed by the session itself (not its position in the list), so the answers
 * stay attached to the right period when the list changes.
 */
export type Answer = 'attended' | 'bunked';
export type SavedAnswers = Record<string, Answer>;

const ANSWERS_KEY = 'dontbunk.portal.answers';
const TARGET_KEY = 'dontbunk.portal.target';

export function answerKey(session: { date: string; fromTime: string; subjectName: string }): string {
  return `${session.date}|${session.fromTime}|${session.subjectName}`;
}

/** Tolerant of a missing, corrupt or hand-edited value: anything unusable is dropped. */
export function parseAnswers(raw: string | null): SavedAnswers {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: SavedAnswers = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === 'attended' || value === 'bunked') result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Keeps only answers for periods that are still ungraded — once the portal grades one, its answer is stale. */
export function pruneAnswers(saved: SavedAnswers, currentKeys: string[]): SavedAnswers {
  const wanted = new Set(currentKeys);
  return Object.fromEntries(Object.entries(saved).filter(([key]) => wanted.has(key)));
}

const CHANGE_EVENT = 'dontbunk:saved-answers';

/** For `useSyncExternalStore`: re-read when this tab saves, or another tab does. */
export function subscribeSaved(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) — it just won't persist */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const readRawAnswers = () => read(ANSWERS_KEY);
export const readRawTarget = () => read(TARGET_KEY);

/** Records one answer on top of whatever is saved right now (read fresh, so quick successive taps never overwrite each other). */
export function saveAnswer(key: string, answer: Answer, currentKeys: string[]): void {
  const merged = { ...parseAnswers(read(ANSWERS_KEY)), [key]: answer };
  // Prune on the way, so answers for periods the portal has since graded don't pile up.
  write(ANSWERS_KEY, JSON.stringify(pruneAnswers(merged, currentKeys)));
}

export function saveTarget(target: string): void {
  write(TARGET_KEY, target);
}

/** Called on log out so nothing about the student is left behind on a shared device. */
export function clearSavedAnswers(): void {
  write(ANSWERS_KEY, null);
  write(TARGET_KEY, null);
}
