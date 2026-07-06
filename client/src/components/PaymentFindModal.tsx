import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type PaymentFindMember = {
  _id: string;
  memberNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: "active" | "expired" | "cancelled";
  createdAt?: string;
  legacyProfile?: Record<string, unknown>;
  oilCompanyId?: { name?: string } | null;
};

type PaymentFindResultRow = {
  id: string;
  memberNumber: string;
  name: string;
  status: string;
  oilCompany: string;
  memberSince: string;
  hasEmail: boolean;
  flags: string;
};

type FindPresetId = "not_paid" | "delinquent" | "renewal_due" | "seniors" | "custom";

const PRESETS: Array<{ id: FindPresetId; label: string; description: string }> = [
  { id: "not_paid", label: "Not paid current year", description: "Flagged “Not Paid Current Yr”" },
  { id: "delinquent", label: "Delinquent", description: "Flagged delinquent" },
  { id: "renewal_due", label: "Renewal due", description: "Active members who are not lifetime-waived" },
  { id: "seniors", label: "Senior members", description: "Marked as a senior citizen" },
];

function memberOilCompany(m: PaymentFindMember, lp: Record<string, unknown>): string {
  const linked =
    m.oilCompanyId && typeof m.oilCompanyId === "object" && "name" in (m.oilCompanyId as { name?: string })
      ? String((m.oilCompanyId as { name?: string }).name || "")
      : "";
  return (linked || String(lp.oilCompanyName || "")).trim();
}

function isMemberNotActive(m: PaymentFindMember, lp: Record<string, unknown>): boolean {
  if (m.status && m.status !== "active") return true;
  const ws = String(lp.workbenchMemberStatus || "").toUpperCase();
  return ws === "INACTIVE" || ws === "CANCELLED";
}

function formatShortDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export type PaymentFindModalProps = {
  open: boolean;
  onClose: () => void;
  members: PaymentFindMember[];
  oilCompanyOptions?: { _id: string; name: string; active?: boolean }[];
  selectedMemberId?: string | null;
  onSelectMember: (memberId: string) => void;
  onEmailResults: (memberIds: string[]) => void;
  onGenerateInvoices: (memberIds: string[], pastDue?: boolean) => void;
};

const defaultFilters = () => ({
  q: "",
  company: "",
  membershipStatus: "" as "" | "active" | "not_active",
  delinquent: false,
  notPaidCurrentYr: false,
  registration: "" as "" | "paid" | "waived" | "unpaid",
  seniorOnly: false,
  excludeLifetime: false,
});

export default function PaymentFindModal({
  open,
  onClose,
  members,
  oilCompanyOptions = [],
  selectedMemberId = null,
  onSelectMember,
  onEmailResults,
  onGenerateInvoices,
}: PaymentFindModalProps) {
  const titleId = useId();
  const [filters, setFilters] = useState(defaultFilters);
  const [activePreset, setActivePreset] = useState<FindPresetId>("custom");
  const [triggered, setTriggered] = useState(false);

  const companyOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (raw: string) => {
      const name = String(raw || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, name);
    };
    for (const oc of oilCompanyOptions) add(oc.name);
    for (const m of members) add(memberOilCompany(m, (m.legacyProfile || {}) as Record<string, unknown>));
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [members, oilCompanyOptions]);

  const applyPreset = (id: FindPresetId) => {
    const base = defaultFilters();
    setActivePreset(id);
    if (id === "not_paid") setFilters({ ...base, notPaidCurrentYr: true });
    else if (id === "delinquent") setFilters({ ...base, delinquent: true });
    else if (id === "renewal_due") setFilters({ ...base, membershipStatus: "active", excludeLifetime: true });
    else if (id === "seniors") setFilters({ ...base, seniorOnly: true });
    else setFilters(base);
    setTriggered(true);
  };

  const patch = (next: Partial<ReturnType<typeof defaultFilters>>) => {
    setActivePreset("custom");
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters());
    setActivePreset("custom");
    setTriggered(false);
  };

  const results = useMemo((): PaymentFindResultRow[] => {
    if (!triggered) return [];
    const qKey = filters.q.trim().toLowerCase();
    const companyKey = filters.company.trim().toLowerCase();

    return members
      .map((m) => {
        const lp = (m.legacyProfile || {}) as Record<string, unknown>;
        const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown";

        if (qKey) {
          const blob = [m.memberNumber, m.firstName, m.lastName, m.email, lp.oilId]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          if (!blob.includes(qKey)) return null;
        }
        if (filters.delinquent && !lp.delinquent) return null;
        if (filters.notPaidCurrentYr && !lp.notPaidCurrentYr) return null;
        if (filters.seniorOnly && !lp.seniorMember) return null;
        if (filters.excludeLifetime && lp.waiveFeeLifetime) return null;

        if (filters.registration) {
          const reg = String(lp.registrationPaymentStatus || "").toLowerCase();
          if (filters.registration === "paid" && reg !== "paid") return null;
          if (filters.registration === "waived" && reg !== "waived") return null;
          if (filters.registration === "unpaid" && (reg === "paid" || reg === "waived")) return null;
        }

        if (filters.membershipStatus === "active" && m.status !== "active") return null;
        if (filters.membershipStatus === "not_active" && !isMemberNotActive(m, lp)) return null;

        const company = memberOilCompany(m, lp);
        if (companyKey && company.toLowerCase() !== companyKey) return null;

        const flags = [
          lp.delinquent ? "Delinquent" : "",
          lp.notPaidCurrentYr ? "Not paid" : "",
          lp.seniorMember ? "Senior" : "",
          lp.waiveFeeLifetime ? "Lifetime" : "",
        ]
          .filter(Boolean)
          .join(", ");

        return {
          id: m._id,
          memberNumber: m.memberNumber || "",
          name,
          status: m.status || "—",
          oilCompany: company || "—",
          memberSince: m.createdAt ? formatShortDate(m.createdAt) : "—",
          hasEmail: Boolean(String(m.email || "").trim()),
          flags: flags || "—",
        };
      })
      .filter((v): v is PaymentFindResultRow => Boolean(v))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [triggered, filters, members]);

  const resultIds = useMemo(() => results.map((r) => r.id), [results]);
  const emailCount = useMemo(() => results.filter((r) => r.hasEmail).length, [results]);

  useEffect(() => {
    if (!open) {
      setTriggered(false);
      setFilters(defaultFilters());
      setActivePreset("custom");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const node = (
    <div
      className="admin-modal-overlay admin-delivery-find-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal-panel admin-delivery-find-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-panel-head">
          <h2 id={titleId}>Find members — payment &amp; renewal</h2>
          <div className="admin-modal-panel-actions">
            <button type="button" className="admin-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <p className="admin-modal-hint admin-delivery-find-empty">
            Load members from the Workbench first — customer-wide search needs the full member list.
          </p>
        ) : (
          <>
            <section className="admin-delivery-find-presets" aria-label="Quick searches">
              <span className="admin-delivery-find-section-label">Quick searches</span>
              <div className="admin-delivery-find-preset-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`admin-delivery-find-preset${activePreset === p.id ? " is-active" : ""}`}
                    onClick={() => applyPreset(p.id)}
                    title={p.description}
                  >
                    <strong>{p.label}</strong>
                    <span>{p.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-delivery-find-filters" aria-label="Search filters">
              <span className="admin-delivery-find-section-label">Custom filters</span>
              <div className="admin-delivery-search-grid admin-delivery-find-grid">
                <div className="admin-modal-field admin-delivery-find-span-2">
                  <span>Name / ID / email</span>
                  <input
                    className="admin-input"
                    value={filters.q}
                    onChange={(e) => patch({ q: e.target.value })}
                    placeholder="Member #, name, email…"
                  />
                </div>
                <div className="admin-modal-field">
                  <span>Oil company</span>
                  <select
                    className="admin-input"
                    value={filters.company}
                    onChange={(e) => patch({ company: e.target.value })}
                    disabled={companyOptions.length === 0}
                  >
                    <option value="">Any</option>
                    {companyOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-modal-field">
                  <span>Membership</span>
                  <select
                    className="admin-input"
                    value={filters.membershipStatus}
                    onChange={(e) => patch({ membershipStatus: e.target.value as "" | "active" | "not_active" })}
                  >
                    <option value="">Any</option>
                    <option value="active">Active only</option>
                    <option value="not_active">Not active / cancelled</option>
                  </select>
                </div>
                <div className="admin-modal-field">
                  <span>Registration</span>
                  <select
                    className="admin-input"
                    value={filters.registration}
                    onChange={(e) => patch({ registration: e.target.value as "" | "paid" | "waived" | "unpaid" })}
                  >
                    <option value="">Any</option>
                    <option value="paid">Paid</option>
                    <option value="waived">Waived</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
              </div>

              <div className="admin-delivery-find-checks">
                <label className="admin-modal-find-check">
                  <input type="checkbox" checked={filters.delinquent} onChange={(e) => patch({ delinquent: e.target.checked })} />
                  Delinquent
                </label>
                <label className="admin-modal-find-check">
                  <input type="checkbox" checked={filters.notPaidCurrentYr} onChange={(e) => patch({ notPaidCurrentYr: e.target.checked })} />
                  Not paid current year
                </label>
                <label className="admin-modal-find-check">
                  <input type="checkbox" checked={filters.seniorOnly} onChange={(e) => patch({ seniorOnly: e.target.checked })} />
                  Senior members only
                </label>
                <label className="admin-modal-find-check">
                  <input type="checkbox" checked={filters.excludeLifetime} onChange={(e) => patch({ excludeLifetime: e.target.checked })} />
                  Exclude lifetime-waived
                </label>
              </div>

              <div className="admin-delivery-find-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setActivePreset("custom");
                    setTriggered(true);
                  }}
                >
                  Search
                </button>
                {triggered && (
                  <button type="button" className="admin-btn" onClick={resetFilters}>
                    Reset
                  </button>
                )}
                <span className="admin-delivery-find-meta">
                  {members.length.toLocaleString()} members loaded
                  {triggered ? ` · ${results.length} match${results.length === 1 ? "" : "es"}` : ""}
                </span>
              </div>
            </section>

            {triggered && results.length > 0 && (
              <div className="admin-delivery-find-actions" style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "0.6rem" }}>
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => onEmailResults(resultIds)}>
                  Email all {emailCount} with email →
                </button>
                <button type="button" className="admin-btn" onClick={() => onGenerateInvoices(resultIds)}>
                  Download {results.length} invoice PDF{results.length === 1 ? "" : "s"}
                </button>
                <button type="button" className="admin-btn" onClick={() => onGenerateInvoices(resultIds, true)}>
                  Download {results.length} PAST DUE PDF
                </button>
                <span className="admin-delivery-find-meta">Click a row to open that member</span>
              </div>
            )}

            {triggered && (
              <div className="admin-table-wrap admin-delivery-find-results">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member #</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Oil company</th>
                      <th>Member since</th>
                      <th>Email?</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="admin-modal-table-empty">
                          No members matched. Try a quick search or loosen the filters.
                        </td>
                      </tr>
                    ) : (
                      results.map((row) => {
                        const isActive = row.id === selectedMemberId;
                        return (
                          <tr
                            key={row.id}
                            className={`admin-modal-find-result-row${isActive ? " is-active" : ""}`}
                            onClick={() => {
                              onSelectMember(row.id);
                              onClose();
                            }}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectMember(row.id);
                                onClose();
                              }
                            }}
                            title="Open this member"
                          >
                            <td>{row.memberNumber || "—"}</td>
                            <td>{row.name}</td>
                            <td>
                              <span className={`admin-pill${row.status === "active" ? " ok" : ""}`}>{row.status}</span>
                            </td>
                            <td>{row.oilCompany}</td>
                            <td>{row.memberSince}</td>
                            <td>{row.hasEmail ? "Yes" : "—"}</td>
                            <td className="admin-delivery-find-hint">{row.flags}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
