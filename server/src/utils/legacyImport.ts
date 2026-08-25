/** Pick the first non-empty column from an Approach/FileMaker transfer row. */
export function pickField(row: Record<string, string>, ...keys: string[]): string {
  const exact = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) exact.set(k.trim().toUpperCase(), v);
  for (const key of keys) {
    const v = (exact.get(key.trim().toUpperCase()) ?? row[key] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** Approach often exported M/D/YY; workbench date inputs need YYYY-MM-DD. */
export function parseLegacyDate(raw: string | undefined | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slash) {
    const mm = Number(slash[1]);
    const dd = Number(slash[2]);
    let yy = Number(slash[3]);
    if (yy < 100) yy += yy >= 50 ? 1900 : 2000;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900 || yy > 2200) return "";
    return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y < 1900 || y > 2200) return "";
    return `${String(y).padStart(4, "0")}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return "";
}

const YES_VALUES = new Set(["y", "yes", "true", "1", "x", "senior", "checked"]);

export function parseLegacyYes(raw: string | undefined | null): boolean {
  return YES_VALUES.has(String(raw ?? "").trim().toLowerCase());
}
