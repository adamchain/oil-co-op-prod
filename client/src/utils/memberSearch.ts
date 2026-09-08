/**
 * Workbench quick-search matching.
 *
 * A long query like "Ken Walker 123 Main Street" must match when each token
 * appears somewhere on the record (name, address, email, …), not only when
 * the entire string sits in a single field. Approach-style searches are often
 * a full name plus street pasted into one box.
 */
export function memberMatchesQuickSearch(
  haystack: string[],
  query: string,
  opts?: { stateOnly?: boolean }
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = haystack.filter(Boolean).map((x) => String(x).toLowerCase());
  if (opts?.stateOnly) {
    return fields.some((field) => field === q);
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return fields.some((field) => field.includes(q));
  }
  if (fields.some((field) => field.includes(q))) return true;
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}
