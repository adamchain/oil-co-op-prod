/**
 * Workbench quick-search matching.
 *
 * A long query like "Ken Walker 123 Main Street" must match when each token
 * appears somewhere on the record (name, address, email, …), not only when
 * the entire string sits in a single field. Approach-style searches are often
 * a full name plus street pasted into one box.
 */
import { stateSynonyms } from "./stateAbbreviations";

export type MemberSearchRecord = {
  memberNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  notes?: string;
  notesHistory?: { text?: string }[];
  oilCompanyId?: { name?: string } | null;
  status?: string;
  legacyProfile?: Record<string, unknown> | null;
};

export function memberQuickSearchHaystack(m: MemberSearchRecord): string[] {
  const lp = (m.legacyProfile || {}) as Record<string, unknown>;
  const legacyValues =
    m.legacyProfile && typeof m.legacyProfile === "object"
      ? Object.values(m.legacyProfile)
      : [];
  const noteHistoryTexts = (m.notesHistory || []).map((n) => n.text || "");
  const fullNameParts = [
    m.firstName,
    lp.midName1,
    m.lastName,
    lp.suffix1,
    lp.firstName2,
    lp.midName2,
    lp.lastName2,
    lp.suffix2,
  ].filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
  const combinedFullName = fullNameParts.join(" ");
  const fullAddress = [m.addressLine1, m.addressLine2, m.city, m.state, m.postalCode]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter(Boolean)
    .join(" ");
  const nameAndAddress = [combinedFullName, fullAddress].filter(Boolean).join(" ");
  return [
    m.memberNumber,
    m.firstName,
    m.lastName,
    combinedFullName,
    nameAndAddress,
    m.email,
    m.phone,
    m.addressLine1,
    m.addressLine2,
    fullAddress,
    m.city,
    m.state,
    ...stateSynonyms(m.state),
    m.postalCode,
    m.notes,
    ...noteHistoryTexts,
    m.oilCompanyId?.name,
    m.status,
    ...legacyValues,
  ].map((x) => String(x ?? ""));
}

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

export function memberRecordMatchesQuery(m: MemberSearchRecord, query: string): boolean {
  return memberMatchesQuickSearch(memberQuickSearchHaystack(m), query);
}
