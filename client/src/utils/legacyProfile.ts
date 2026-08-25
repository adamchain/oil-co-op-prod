/**
 * Approach / FileMaker transfer files stored several workbench fields under
 * different keys or as "Y"/Excel-style dates. Hydrate those onto the labels
 * the Data Entry tab actually binds to so imported records don't look empty.
 */

const YES_VALUES = new Set(["y", "yes", "true", "1", "x", "senior", "checked"]);

/** HTML date inputs need YYYY-MM-DD; Approach often exported M/D/YY. */
export function toDateInputValue(raw: unknown): string {
  if (raw == null) return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
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

export function parseLegacyYes(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false || raw == null) return false;
  return YES_VALUES.has(String(raw).trim().toLowerCase());
}

function firstDate(lp: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const iso = toDateInputValue(lp[k]);
    if (iso) return iso;
  }
  return "";
}

function firstPhone(lp: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(lp[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/**
 * Copy Approach/import aliases onto the workbench field names in place.
 * Does not overwrite a canonical value that is already set.
 */
export function hydrateLegacyProfile(lp: Record<string, unknown>): Record<string, unknown> {
  if (!String(lp.newMemberDt ?? "").trim()) {
    const iso = firstDate(lp, ["newMemberDt", "NEW_MEMBER", "NEW_MEM_DT", "NEW_MEM_DA", "dateAdd", "DATE_ADD"]);
    if (iso) lp.newMemberDt = iso;
  } else {
    const iso = toDateInputValue(lp.newMemberDt);
    if (iso) lp.newMemberDt = iso;
  }

  if (!String(lp.originalStartDate ?? "").trim()) {
    const iso = firstDate(lp, [
      "originalStartDate",
      "ORIG_START",
      "ORIGINAL_S",
      "ORIG_DATE",
      "DATE_START",
      "START_DATE",
      "FIRST_DATE",
      "origStart",
    ]);
    if (iso) lp.originalStartDate = iso;
  } else {
    const iso = toDateInputValue(lp.originalStartDate);
    if (iso) lp.originalStartDate = iso;
  }

  if (typeof lp.seniorMember !== "boolean") {
    lp.seniorMember = parseLegacyYes(lp.seniorMember) || parseLegacyYes(lp.seniorFlag) || parseLegacyYes(lp.SENIOR);
  }

  if (!String(lp.phone2 ?? "").trim()) {
    const p2 = firstPhone(lp, ["phone2", "PHONE_2", "Phone2"]);
    if (p2) lp.phone2 = p2;
  }
  if (!String(lp.phone3 ?? "").trim()) {
    const p3 = firstPhone(lp, ["phone3", "PHONE_3", "Phone3"]);
    if (p3) lp.phone3 = p3;
  }

  return lp;
}
