/**
 * Academic years are plain numbers in the database (`sections.year`). This is
 * the one place that turns one into words, so the public picker and the admin
 * panel can never disagree about what "3" is called.
 */

/** The years the UI offers. The database allows 1-4 (migration 017). */
export const SUPPORTED_YEARS = [2, 3] as const;

/** "2nd year", "3rd year" — the label students and admins actually use. */
export function yearLabel(year: number): string {
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
  return `${year}${suffix} year`;
}
