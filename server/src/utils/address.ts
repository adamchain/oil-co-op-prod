/** Address normalization helpers for flexible duplicate matching. */

const STREET_TOKENS: Record<string, string> = {
  street: "st",
  streets: "st",
  str: "st",
  st: "st",
  avenue: "ave",
  avenues: "ave",
  ave: "ave",
  av: "ave",
  road: "rd",
  roads: "rd",
  rd: "rd",
  drive: "dr",
  drives: "dr",
  dr: "dr",
  lane: "ln",
  lanes: "ln",
  ln: "ln",
  court: "ct",
  courts: "ct",
  ct: "ct",
  boulevard: "blvd",
  blvd: "blvd",
  circle: "cir",
  cir: "cir",
  place: "pl",
  pl: "pl",
  terrace: "ter",
  ter: "ter",
  highway: "hwy",
  hwy: "hwy",
  parkway: "pkwy",
  pkwy: "pkwy",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  n: "n",
  s: "s",
  e: "e",
  w: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
  ne: "ne",
  nw: "nw",
  se: "se",
  sw: "sw",
};

/** First 5 digits of a ZIP / ZIP+4. */
export function normalizePostalCode(raw: string | undefined | null): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function normalizeState(raw: string | undefined | null): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

export function normalizeCity(raw: string | undefined | null): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapse street lines for comparison:
 * lowercase, strip punctuation / unit designators, canonicalize suffixes.
 */
export function normalizeStreet(raw: string | undefined | null): string {
  let s = String(raw ?? "")
    .toLowerCase()
    .replace(/[#.,'"`]/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Drop apartment / unit / suite tails so "123 Main St Apt 2" ≈ "123 Main St"
  s = s
    .replace(/\b(apartment|apt|unit|suite|ste|floor|fl|rm|room|bldg|building)\b\.?\s*[a-z0-9-]*\b/gi, " ")
    .replace(/#\s*[a-z0-9-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = s.split(" ").filter(Boolean).map((tok) => STREET_TOKENS[tok] || tok);
  return parts.join(" ").trim();
}

export function streetsLooselyMatch(aRaw: string, bRaw: string): boolean {
  const a = normalizeStreet(aRaw);
  const b = normalizeStreet(bRaw);
  if (!a || !b) return false;
  if (a === b) return true;
  // "123 main" vs "123 main st"
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const ta = a.split(" ");
  const tb = b.split(" ");
  // Same house number + next significant token
  if (ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0] && ta[1] === tb[1]) return true;
  return false;
}

export type AddressParts = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export function addressesLooselyMatch(a: AddressParts, b: AddressParts): boolean {
  const zipA = normalizePostalCode(a.postalCode);
  const zipB = normalizePostalCode(b.postalCode);
  if (!zipA || !zipB || zipA !== zipB) return false;

  const stateA = normalizeState(a.state);
  const stateB = normalizeState(b.state);
  if (stateA && stateB && stateA !== stateB) return false;

  const cityA = normalizeCity(a.city);
  const cityB = normalizeCity(b.city);
  if (cityA && cityB && cityA !== cityB) return false;

  const streetA = [a.addressLine1, a.addressLine2].filter(Boolean).join(" ");
  const streetB = [b.addressLine1, b.addressLine2].filter(Boolean).join(" ");
  return streetsLooselyMatch(streetA, streetB);
}
