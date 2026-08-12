import { SiteContent } from "../models/SiteContent.js";

/**
 * Return the admin-saved content overrides as a plain object keyed by content
 * key. Empty when nothing has been customized yet — the client then renders its
 * built-in defaults. Entries are persisted as an array of { key, value } pairs
 * (dotted keys can't be MongoDB field names); we flatten them back to an object
 * here so callers get the simple key -> text shape the client expects.
 */
export async function getSiteContentValues(): Promise<Record<string, string>> {
  const doc = await SiteContent.findOne({ singleton: "site-content" }).lean();
  const entries = (doc as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) return {};
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const key = (entry as { key?: unknown })?.key;
    if (typeof key === "string" && key) {
      out[key] = String((entry as { value?: unknown })?.value ?? "");
    }
  }
  return out;
}
