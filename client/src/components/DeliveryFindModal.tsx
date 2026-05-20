import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type DeliveryFindMember = {
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

type DeliveryHistoryRow = {
  dateDelivered: string;
  deliveryYear: number;
  fuelType: "OIL" | "PROPANE";
  gallons: number;
};

export type FindResultRow = {
  id: string;
  memberNumber: string;
  name: string;
  status: string;
  oilStatus: string;
  memberSince: string;
  deliveries: number;
  gallons: number;
  lastDelivery: string;
  hint: string;
};

type FindPresetId =
  | "march_no_recent"
  | "delivered_inactive"
  | "new_members_7d"
  | "delinquent_delivered"
  | "custom";

const MONTHS = [
  { value: "", label: "Any month" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const PRESETS: Array<{
  id: FindPresetId;
  label: string;
  description: string;
}> = [
  {
    id: "march_no_recent",
    label: "March delivery, no recent",
    description: "Had oil/propane in March but nothing in the last 12 months",
  },
  {
    id: "delivered_inactive",
    label: "Delivered, not active",
    description: "Has matching deliveries but membership or fuel status is inactive",
  },
  {
    id: "new_members_7d",
    label: "New members (7 days)",
    description: "Joined in the last 7 days (optionally with deliveries)",
  },
  {
    id: "delinquent_delivered",
    label: "Delinquent + delivered",
    description: "Marked delinquent with deliveries in the selected period",
  },
];

function parseRowsFromLegacy(raw: unknown): DeliveryHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const dateDelivered = String(rec.dateDelivered || "");
      const deliveryYear = Number(rec.deliveryYear);
      const fuelType = String(rec.fuelType || "OIL").toUpperCase();
      const gallons = Number(rec.gallons);
      if (!dateDelivered || !Number.isFinite(deliveryYear) || !Number.isFinite(gallons)) return null;
      if (fuelType !== "OIL" && fuelType !== "PROPANE") return null;
      return { dateDelivered, deliveryYear, fuelType: fuelType as "OIL" | "PROPANE", gallons };
    })
    .filter((v): v is DeliveryHistoryRow => Boolean(v));
}

function memberOilStatus(lp: Record<string, unknown>): string {
  return String(lp.oilWorkbenchStatus || lp.workbenchMemberStatus || "UNKNOWN").toUpperCase();
}

function memberPropStatus(lp: Record<string, unknown>): string {
  return String(lp.propaneStatus || "UNKNOWN").toUpperCase();
}

function isFuelInactive(status: string): boolean {
  return status === "INACTIVE" || status === "NO OIL" || status === "NO PROPANE";
}

function isMemberNotActive(m: DeliveryFindMember, lp: Record<string, unknown>): boolean {
  if (m.status && m.status !== "active") return true;
  const ws = String(lp.workbenchMemberStatus || "").toUpperCase();
  if (ws === "INACTIVE" || ws === "CANCELLED") return true;
  return isFuelInactive(memberOilStatus(lp)) || isFuelInactive(memberPropStatus(lp));
}

function rowMatchesDeliveryFilters(
  row: DeliveryHistoryRow,
  opts: {
    yearNum: number | null;
    monthNum: number | null;
    fuel: "" | "OIL" | "PROPANE" | "NRD_OIL" | "NRD_PROP";
    minGallons: number | null;
  }
): boolean {
  const d = new Date(row.dateDelivered);
  if (opts.yearNum != null && d.getFullYear() !== opts.yearNum) return false;
  if (opts.monthNum != null && d.getMonth() + 1 !== opts.monthNum) return false;
  if (opts.fuel === "OIL" && row.fuelType !== "OIL") return false;
  if (opts.fuel === "PROPANE" && row.fuelType !== "PROPANE") return false;
  if (opts.fuel === "NRD_OIL" && row.fuelType !== "OIL") return false;
  if (opts.fuel === "NRD_PROP" && row.fuelType !== "PROPANE") return false;
  if (opts.minGallons != null && row.gallons < opts.minGallons) return false;
  return true;
}

function hasRecentDelivery(rows: DeliveryHistoryRow[], months: number, now = new Date()): boolean {
  if (months <= 0) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return rows.some((r) => {
    const d = new Date(r.dateDelivered);
    return !Number.isNaN(d.getTime()) && d >= cutoff;
  });
}

function memberCreatedWithinDays(m: DeliveryFindMember, days: number, now = new Date()): boolean {
  if (days <= 0 || !m.createdAt) return false;
  const created = new Date(m.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return created >= cutoff;
}

function formatShortDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export type DeliveryFindModalProps = {
  open: boolean;
  onClose: () => void;
  members: DeliveryFindMember[];
  selectedMemberId?: string | null;
  onSelectMember: (memberId: string) => void;
};

const defaultFilters = () => ({
  q: "",
  year: String(new Date().getFullYear()),
  month: "",
  fuel: "" as "" | "OIL" | "PROPANE" | "NRD_OIL" | "NRD_PROP",
  company: "",
  minGallons: "",
  delinquent: false,
  notPaidCurrentYr: false,
  membershipStatus: "" as "" | "active" | "not_active",
  oilInactiveOnly: false,
  requireMatchingDelivery: true,
  noRecentMonths: 0,
  newMemberDays: 0,
  anyDeliveryEver: false,
});

export default function DeliveryFindModal({
  open,
  onClose,
  members,
  selectedMemberId = null,
  onSelectMember,
}: DeliveryFindModalProps) {
  const titleId = useId();
  const [filters, setFilters] = useState(defaultFilters);
  const [activePreset, setActivePreset] = useState<FindPresetId>("custom");
  const [triggered, setTriggered] = useState(false);

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) {
      const lp = (m.legacyProfile || {}) as Record<string, unknown>;
      const oc = String(lp.oilCompanyName || "").trim();
      const pc = String(lp.propaneCompanyName || "").trim();
      if (oc) set.add(oc);
      if (pc) set.add(pc);
      const linked =
        m.oilCompanyId && typeof m.oilCompanyId === "object" && "name" in (m.oilCompanyId as { name?: string })
          ? String((m.oilCompanyId as { name?: string }).name || "").trim()
          : "";
      if (linked) set.add(linked);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [members]);

  const applyPreset = (id: FindPresetId) => {
    const base = defaultFilters();
    setActivePreset(id);
    if (id === "march_no_recent") {
      setFilters({
        ...base,
        month: "03",
        requireMatchingDelivery: true,
        noRecentMonths: 12,
        membershipStatus: "",
      });
    } else if (id === "delivered_inactive") {
      setFilters({
        ...base,
        year: "",
        month: "",
        requireMatchingDelivery: false,
        anyDeliveryEver: true,
        membershipStatus: "not_active",
        oilInactiveOnly: false,
      });
    } else if (id === "new_members_7d") {
      setFilters({
        ...base,
        year: "",
        month: "",
        requireMatchingDelivery: false,
        newMemberDays: 7,
        anyDeliveryEver: false,
      });
    } else if (id === "delinquent_delivered") {
      setFilters({
        ...base,
        delinquent: true,
        requireMatchingDelivery: true,
      });
    } else {
      setFilters(base);
    }
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

  const results = useMemo((): FindResultRow[] => {
    if (!triggered) return [];

    const yearNum = filters.year.trim() ? Number(filters.year) : null;
    const monthNum = filters.month ? Number(filters.month) : null;
    const minGallons = filters.minGallons.trim() ? Number(filters.minGallons) : null;
    const companyKey = filters.company.trim().toLowerCase();
    const qKey = filters.q.trim().toLowerCase();
    const hasDeliveryCriteria =
      filters.requireMatchingDelivery &&
      (yearNum != null ||
        monthNum != null ||
        filters.fuel !== "" ||
        Boolean(companyKey) ||
        minGallons != null);
    const memberOnlySearch =
      !hasDeliveryCriteria &&
      (filters.newMemberDays > 0 ||
        filters.membershipStatus !== "" ||
        filters.delinquent ||
        filters.notPaidCurrentYr ||
        filters.oilInactiveOnly ||
        filters.anyDeliveryEver);

    if (!hasDeliveryCriteria && !memberOnlySearch && filters.noRecentMonths <= 0) return [];

    const now = new Date();

    return members
      .map((m) => {
        const lp = (m.legacyProfile || {}) as Record<string, unknown>;
        const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown";

        if (qKey) {
          const blob = [m.memberNumber, m.firstName, m.lastName, m.email, lp.oilId, lp.propaneId]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          if (!blob.includes(qKey)) return null;
        }

        if (filters.delinquent && !Boolean(lp.delinquent)) return null;
        if (filters.notPaidCurrentYr && !Boolean(lp.notPaidCurrentYr)) return null;

        if (filters.membershipStatus === "active" && m.status !== "active") return null;
        if (filters.membershipStatus === "not_active" && !isMemberNotActive(m, lp)) return null;

        if (filters.oilInactiveOnly && !isFuelInactive(memberOilStatus(lp))) return null;

        if (filters.newMemberDays > 0 && !memberCreatedWithinDays(m, filters.newMemberDays, now)) return null;

        if (companyKey) {
          const oc = String(lp.oilCompanyName || "").trim().toLowerCase();
          const pc = String(lp.propaneCompanyName || "").trim().toLowerCase();
          const linked =
            m.oilCompanyId && typeof m.oilCompanyId === "object" && "name" in (m.oilCompanyId as { name?: string })
              ? String((m.oilCompanyId as { name?: string }).name || "").trim().toLowerCase()
              : "";
          if (oc !== companyKey && pc !== companyKey && linked !== companyKey) return null;
        }

        if (filters.fuel === "NRD_OIL" && !Boolean(lp.nrdOil)) return null;
        if (filters.fuel === "NRD_PROP" && !Boolean(lp.nrdProp)) return null;

        const rows = parseRowsFromLegacy(lp.deliveryHistoryRows);

        if (filters.noRecentMonths > 0 && hasRecentDelivery(rows, filters.noRecentMonths, now)) return null;

        let matches = rows;
        if (hasDeliveryCriteria) {
          matches = rows.filter((row) =>
            rowMatchesDeliveryFilters(row, {
              yearNum: yearNum != null && Number.isFinite(yearNum) ? yearNum : null,
              monthNum: monthNum != null && monthNum >= 1 && monthNum <= 12 ? monthNum : null,
              fuel: filters.fuel,
              minGallons: minGallons != null && Number.isFinite(minGallons) ? minGallons : null,
            })
          );
          if (matches.length === 0) return null;
        } else if (filters.anyDeliveryEver && rows.length === 0) {
          return null;
        }

        const sorted = [...rows].sort((a, b) => b.dateDelivered.localeCompare(a.dateDelivered));
        const last = sorted[0];

        let hint = "";
        if (filters.noRecentMonths > 0 && matches.length > 0) {
          hint = `No delivery in last ${filters.noRecentMonths} mo`;
        } else if (filters.newMemberDays > 0) {
          hint = `Joined ${formatShortDate(m.createdAt || "")}`;
        } else if (isMemberNotActive(m, lp)) {
          hint = "Inactive account";
        }

        return {
          id: m._id,
          memberNumber: m.memberNumber || "",
          name,
          status: m.status || "—",
          oilStatus: memberOilStatus(lp),
          memberSince: m.createdAt ? formatShortDate(m.createdAt) : "—",
          deliveries: matches.length > 0 ? matches.length : rows.length,
          gallons: (matches.length > 0 ? matches : rows).reduce((s, r) => s + r.gallons, 0),
          lastDelivery: last ? formatShortDate(last.dateDelivered) : "—",
          hint,
        };
      })
      .filter((v): v is FindResultRow => Boolean(v))
      .sort((a, b) => b.gallons - a.gallons || a.name.localeCompare(b.name));
  }, [triggered, filters, members]);

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
          <h2 id={titleId}>Find members — delivery search</h2>
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
                    placeholder="Member #, name, email, oil ID…"
                  />
                </div>
                <div className="admin-modal-field">
                  <span>Delivery year</span>
                  <input
                    className="admin-input"
                    value={filters.year}
                    onChange={(e) => patch({ year: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
                    placeholder="Any"
                    inputMode="numeric"
                  />
                </div>
                <div className="admin-modal-field">
                  <span>Delivery month</span>
                  <select className="admin-input" value={filters.month} onChange={(e) => patch({ month: e.target.value })}>
                    {MONTHS.map((m) => (
                      <option key={m.value || "any"} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-modal-field">
                  <span>Fuel / NRD</span>
                  <select
                    className="admin-input"
                    value={filters.fuel}
                    onChange={(e) =>
                      patch({ fuel: e.target.value as "" | "OIL" | "PROPANE" | "NRD_OIL" | "NRD_PROP" })
                    }
                  >
                    <option value="">Any</option>
                    <option value="OIL">Oil</option>
                    <option value="PROPANE">Propane</option>
                    <option value="NRD_OIL">NRD-Oil</option>
                    <option value="NRD_PROP">NRD-Prop</option>
                  </select>
                </div>
                <div className="admin-modal-field">
                  <span>Company</span>
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
                  <span>Min gallons</span>
                  <input
                    className="admin-input"
                    value={filters.minGallons}
                    onChange={(e) => patch({ minGallons: e.target.value.replace(/[^\d.]/g, "") })}
                    placeholder="Any"
                    inputMode="decimal"
                  />
                </div>
                <div className="admin-modal-field">
                  <span>No delivery in last</span>
                  <select
                    className="admin-input"
                    value={String(filters.noRecentMonths)}
                    onChange={(e) => patch({ noRecentMonths: Number(e.target.value) })}
                    title="Exclude members who had any delivery within this many months"
                  >
                    <option value="0">— ignore —</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="18">18 months</option>
                    <option value="24">24 months</option>
                  </select>
                </div>
                <div className="admin-modal-field">
                  <span>New member within</span>
                  <select
                    className="admin-input"
                    value={String(filters.newMemberDays)}
                    onChange={(e) => patch({ newMemberDays: Number(e.target.value) })}
                  >
                    <option value="0">— ignore —</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
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
                    <option value="not_active">Not active / inactive fuel</option>
                  </select>
                </div>
              </div>

              <div className="admin-delivery-find-checks">
                <label className="admin-modal-find-check">
                  <input
                    type="checkbox"
                    checked={filters.delinquent}
                    onChange={(e) => patch({ delinquent: e.target.checked })}
                  />
                  Delinquent
                </label>
                <label className="admin-modal-find-check">
                  <input
                    type="checkbox"
                    checked={filters.notPaidCurrentYr}
                    onChange={(e) => patch({ notPaidCurrentYr: e.target.checked })}
                  />
                  Not paid current year
                </label>
                <label className="admin-modal-find-check">
                  <input
                    type="checkbox"
                    checked={filters.oilInactiveOnly}
                    onChange={(e) => patch({ oilInactiveOnly: e.target.checked })}
                  />
                  Oil status inactive / no oil
                </label>
                <label className="admin-modal-find-check">
                  <input
                    type="checkbox"
                    checked={filters.anyDeliveryEver}
                    onChange={(e) => patch({ anyDeliveryEver: e.target.checked, requireMatchingDelivery: !e.target.checked })}
                  />
                  Any delivery on file (ignore month/year)
                </label>
                <label className="admin-modal-find-check">
                  <input
                    type="checkbox"
                    checked={filters.requireMatchingDelivery}
                    onChange={(e) => patch({ requireMatchingDelivery: e.target.checked, anyDeliveryEver: e.target.checked ? false : filters.anyDeliveryEver })}
                  />
                  Require delivery in selected period
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

            {triggered && (
              <div className="admin-table-wrap admin-delivery-find-results">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member #</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Oil st</th>
                      <th>Joined</th>
                      <th>Deliveries</th>
                      <th>Gallons</th>
                      <th>Last del.</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="admin-modal-table-empty">
                          No members matched. Try a quick search or loosen filters (e.g. clear year or turn off
                          &quot;Require delivery in selected period&quot; for new-member-only searches).
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
                            title="View this member in delivery history"
                          >
                            <td>{row.memberNumber || "—"}</td>
                            <td>{row.name}</td>
                            <td>
                              <span className={`admin-pill${row.status === "active" ? " ok" : ""}`}>{row.status}</span>
                            </td>
                            <td>{row.oilStatus}</td>
                            <td>{row.memberSince}</td>
                            <td>{row.deliveries}</td>
                            <td>{row.gallons.toFixed(1)}</td>
                            <td>{row.lastDelivery}</td>
                            <td className="admin-delivery-find-hint">{row.hint || "—"}</td>
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
