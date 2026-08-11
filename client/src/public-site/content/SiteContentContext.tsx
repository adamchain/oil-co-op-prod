import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../api";
import { SITE_CONTENT_GROUPS } from "./registry";

/** key -> built-in default text, flattened from every page's content group. */
export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(
  SITE_CONTENT_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, field.value]))
);

const SiteContentContext = createContext<Record<string, string>>({});

/**
 * Fetches admin content overrides once and exposes them to the tree. Public
 * marketing pages read text through {@link useSiteText}; until the fetch
 * resolves (or if it fails) the built-in defaults render, so there is never a
 * blank flash.
 */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    api<{ values: Record<string, string> }>("/api/site-content")
      .then((data) => {
        if (active) setOverrides(data.values ?? {});
      })
      .catch(() => {
        /* keep defaults on failure */
      });
    return () => {
      active = false;
    };
  }, []);

  return <SiteContentContext.Provider value={overrides}>{children}</SiteContentContext.Provider>;
}

/**
 * Returns `t(key)` — the admin override for `key` when set and non-empty,
 * otherwise the built-in default. Unknown keys return an empty string.
 */
export function useSiteText(): (key: string) => string {
  const overrides = useContext(SiteContentContext);
  return useMemo(
    () => (key: string) => {
      const override = overrides[key];
      if (override != null && override.trim() !== "") return override;
      return CONTENT_DEFAULTS[key] ?? "";
    },
    [overrides]
  );
}
