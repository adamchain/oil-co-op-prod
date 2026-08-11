import { SiteContent } from "../models/SiteContent.js";

/**
 * Return the admin-saved content overrides as a plain object. Empty when nothing
 * has been customized yet — the client then renders its built-in defaults.
 */
export async function getSiteContentValues(): Promise<Record<string, string>> {
  const doc = await SiteContent.findOne({ singleton: "site-content" }).lean();
  const values = (doc as { values?: unknown } | null)?.values;
  if (!values) return {};
  if (values instanceof Map) return Object.fromEntries(values) as Record<string, string>;
  return values as Record<string, string>;
}
