const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-09" -> "Oct 09". Display only — the app keeps ISO dates everywhere else. */
export function formatDay(iso: string): string {
  const [, month, day] = iso.split('-');
  const name = MONTHS[Number(month) - 1];
  return name && day ? `${name} ${day}` : iso;
}
