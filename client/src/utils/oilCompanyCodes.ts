/**
 * Approach stored oil companies as short codes (OIL_CO / oilCoRaw), e.g. VLIAN.
 * Matching a workbench filter to those records needs the code as well as the
 * display name and Mongo id.
 */
export const OIL_COMPANY_CODE_NAMES: Array<{ code: string; name: string }> = [
  { code: "ALLI", name: "Alliance Express" },
  { code: "TLC", name: "AUTOMATIC TLC" },
  { code: "CRC", name: "CONNECTICUT REFINING CO." },
  { code: "DDLC", name: "DDLC ENERGY" },
  { code: "DEITCH", name: "Deitch Energy, LLC" },
  { code: "DOM", name: "Dominick Fuel" },
  { code: "FFH", name: "F.F. Hitchcock" },
  { code: "HALE", name: "Hale Hill Biofuels" },
  { code: "HIHO", name: "Hi Ho Petroleum" },
  { code: "HOFF", name: "Hoffman Energy" },
  { code: "MTN", name: "Hometown Heating" },
  { code: "IVES", name: "Ives Brothers" },
  { code: "KAUF", name: "Kaufman Fuel" },
  { code: "MERC", name: "Mercury Energy" },
  { code: "MIRA", name: "Mirabito Energy" },
  { code: "KAS", name: "PETRO FUEL" },
  { code: "PetRI", name: "Petro Fuel" },
  { code: "POW", name: "Power Fuel" },
  { code: "RIVER", name: "River Valley Oil Service" },
  { code: "SAVE", name: "Saveway Petroleum" },
  { code: "SUP", name: "Superior Plus" },
  { code: "THOM", name: "Thomaston Oil" },
  { code: "VLIAN", name: "Valiant Energy Solutions" },
  { code: "VAL", name: "Valley Saybrook Oil" },
];

export function namesLooselyMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

export function oilCompanyCodeFromNotes(notes?: string): string {
  return String(notes || "").match(/\bCode:\s*([A-Za-z0-9]+)/i)?.[1]?.trim() || "";
}

export function oilCompanyAliases(name: string, extraCodes: string[] = []): { names: string[]; codes: string[] } {
  const names = new Set<string>();
  const codes = new Set<string>();
  const trimmed = name.trim();
  if (trimmed) names.add(trimmed);
  for (const code of extraCodes) {
    const c = code.trim();
    if (c) codes.add(c);
  }
  for (const row of OIL_COMPANY_CODE_NAMES) {
    if (!row.code) continue;
    const codeHit = [...codes].some((c) => c.toLowerCase() === row.code.toLowerCase());
    if (codeHit || (trimmed && namesLooselyMatch(row.name, trimmed))) {
      names.add(row.name);
      codes.add(row.code);
    }
  }
  return { names: [...names], codes: [...codes] };
}
