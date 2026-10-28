/**
 * Search box filtering for lists the server can't search (owner 2026-10-28: every table has a search).
 * Matches when the trimmed term is empty or any value contains it, ignoring case.
 */
export function matchesText(term: string, ...values: (string | null | undefined)[]): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value != null && value.toLowerCase().includes(needle));
}
