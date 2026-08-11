import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";
import { SITE_CONTENT_GROUPS } from "../public-site/content/registry";
import { CONTENT_DEFAULTS } from "../public-site/content/SiteContentContext";

/**
 * Admin → Site Content. Lets staff edit every string on the public marketing
 * pages. Structure, labels and defaults come from the client content registry;
 * only values that differ from the default are persisted as overrides.
 */
export default function AdminSiteContentPage() {
  const { token } = useAuth();
  // Working copy of the text for every known key, seeded with defaults.
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...CONTENT_DEFAULTS }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api<{ values: Record<string, string> }>("/api/admin/site-content", { token })
      .then((data) => {
        if (!active) return;
        setValues({ ...CONTENT_DEFAULTS, ...(data.values ?? {}) });
      })
      .catch((err) => {
        if (active) setMsg(err instanceof Error ? err.message : "Failed to load content");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const dirtyCount = useMemo(
    () => Object.keys(CONTENT_DEFAULTS).filter((key) => (values[key] ?? "") !== CONTENT_DEFAULTS[key]).length,
    [values]
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SITE_CONTENT_GROUPS;
    return SITE_CONTENT_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.filter(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q) ||
          (values[f.key] ?? "").toLowerCase().includes(q)
      ),
    })).filter((group) => group.fields.length > 0 || group.title.toLowerCase().includes(q));
  }, [query, values]);

  function setValue(key: string, next: string) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  function resetField(key: string) {
    setValue(key, CONTENT_DEFAULTS[key] ?? "");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    // Persist only keys whose text differs from the built-in default.
    const overrides: Record<string, string> = {};
    for (const key of Object.keys(CONTENT_DEFAULTS)) {
      const val = values[key] ?? "";
      if (val !== CONTENT_DEFAULTS[key]) overrides[key] = val;
    }
    try {
      const data = await api<{ values: Record<string, string> }>("/api/admin/site-content", {
        method: "PUT",
        token,
        body: JSON.stringify({ values: overrides }),
      });
      setValues({ ...CONTENT_DEFAULTS, ...(data.values ?? {}) });
      setMsg("Saved. Changes are live on the public site.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-site-content-page">
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>Site Content</h1>
      <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.92rem", maxWidth: "44rem" }}>
        Edit the text shown on the public marketing pages. Only the wording is editable here — layout and images are
        unchanged. Blank a field and use Reset to restore the original text. Saved changes go live immediately.
      </p>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#fff",
          padding: "0.5rem 0",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "1rem",
        }}
      >
        <input
          className="admin-input"
          placeholder="Filter by page, label, or text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: "22rem", flex: "1 1 16rem" }}
        />
        <button type="button" className="admin-btn admin-btn-primary" disabled={saving || loading} onClick={() => void save()}>
          {saving ? "Saving…" : `Save${dirtyCount ? ` (${dirtyCount})` : ""}`}
        </button>
        {msg && (
          <span style={{ color: msg.toLowerCase().includes("fail") ? "#b91c1c" : "#0e763c", fontSize: "0.9rem" }}>
            {msg}
          </span>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading…</p>
      ) : (
        groups.map((group) => (
          <section key={group.page} className="admin-card" style={{ marginBottom: "1.25rem" }}>
            <h2>{group.title}</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {group.fields.map((field) => {
                const val = values[field.key] ?? "";
                const changed = val !== CONTENT_DEFAULTS[field.key];
                return (
                  <label key={field.key} style={{ display: "grid", gap: "0.3rem" }}>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        {field.label}
                        {changed && <span style={{ color: "#0e763c", fontWeight: 400 }}> · edited</span>}
                      </span>
                      {changed && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          style={{ padding: "0.1rem 0.5rem", fontSize: "0.78rem" }}
                          onClick={() => resetField(field.key)}
                        >
                          Reset
                        </button>
                      )}
                    </span>
                    {field.multiline ? (
                      <textarea
                        className="admin-input"
                        value={val}
                        rows={Math.min(10, Math.max(2, Math.ceil(val.length / 70)))}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        style={{ resize: "vertical", lineHeight: 1.5 }}
                      />
                    ) : (
                      <input className="admin-input" value={val} onChange={(e) => setValue(field.key, e.target.value)} />
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
