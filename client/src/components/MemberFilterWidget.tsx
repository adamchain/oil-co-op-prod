import { useEffect, useMemo, useRef, useState } from "react";

export type FilterFieldType = "text" | "date" | "boolean" | "enum" | "ref";

export type FilterOperator =
  | "contains"
  | "equals"
  | "starts_with"
  | "is_empty"
  | "is_not_empty"
  | "before"
  | "after"
  | "on"
  | "is_true"
  | "is_false"
  | "is"
  | "is_not";

export type FilterFieldOption = { value: string; label: string };

export type FilterFieldDef = {
  key: string;
  label: string;
  type: FilterFieldType;
  group: string;
  options?: FilterFieldOption[];
};

export type MemberFilter = {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
};

export const STATIC_FILTER_FIELDS: FilterFieldDef[] = [
  // Identity
  { key: "memberNumber", label: "Member #", type: "text", group: "Identity" },
  { key: "firstName", label: "First Name", type: "text", group: "Identity" },
  { key: "lastName", label: "Last Name", type: "text", group: "Identity" },
  { key: "legacyProfile.legacyId", label: "Legacy ID", type: "text", group: "Identity" },
  { key: "legacyProfile.midName1", label: "Mid Name 1", type: "text", group: "Identity" },
  { key: "legacyProfile.suffix1", label: "Suffix 1", type: "text", group: "Identity" },
  { key: "legacyProfile.firstName2", label: "First Name 2", type: "text", group: "Identity" },
  { key: "legacyProfile.midName2", label: "Mid Name 2", type: "text", group: "Identity" },
  { key: "legacyProfile.lastName2", label: "Last Name 2", type: "text", group: "Identity" },
  { key: "legacyProfile.suffix2", label: "Suffix 2", type: "text", group: "Identity" },
  { key: "legacyProfile.useBothNames", label: "Use Both Names", type: "boolean", group: "Identity" },
  { key: "legacyProfile.standardMembership", label: "Standard Membership", type: "boolean", group: "Identity" },
  { key: "legacyProfile.seniorMember", label: "Senior Member", type: "boolean", group: "Identity" },
  { key: "legacyProfile.lowVolume", label: "Low Volume", type: "boolean", group: "Identity" },
  { key: "legacyProfile.waiveFeeLifetime", label: "Lifetime", type: "boolean", group: "Identity" },
  { key: "legacyProfile.waiveFeeSenior", label: "Waive Fee — Senior", type: "boolean", group: "Identity" },
  { key: "legacyProfile.mailAddr", label: "Mail Addr", type: "boolean", group: "Identity" },
  { key: "legacyProfile.newMemberDt", label: "New Member Date", type: "date", group: "Identity" },
  { key: "legacyProfile.originalStartDate", label: "Original Start Date", type: "date", group: "Identity" },
  { key: "createdAt", label: "Created At", type: "date", group: "Identity" },

  // Address
  { key: "addressLine1", label: "Street", type: "text", group: "Address" },
  { key: "addressLine2", label: "Address Line 2", type: "text", group: "Address" },
  { key: "legacyProfile.aptNo1", label: "Apt No", type: "text", group: "Address" },
  { key: "legacyProfile.streetNo", label: "Street No", type: "text", group: "Address" },
  { key: "city", label: "City", type: "text", group: "Address" },
  { key: "state", label: "State", type: "text", group: "Address" },
  { key: "postalCode", label: "Zip", type: "text", group: "Address" },

  // Contact
  { key: "phone", label: "Phone 1", type: "text", group: "Contact" },
  { key: "legacyProfile.typePhone1", label: "Phone 1 Type", type: "text", group: "Contact" },
  { key: "legacyProfile.p1Ext", label: "Phone 1 Ext", type: "text", group: "Contact" },
  { key: "legacyProfile.phone2", label: "Phone 2", type: "text", group: "Contact" },
  { key: "legacyProfile.typePhone2", label: "Phone 2 Type", type: "text", group: "Contact" },
  { key: "legacyProfile.p2Ext", label: "Phone 2 Ext", type: "text", group: "Contact" },
  { key: "legacyProfile.phone3", label: "Phone 3", type: "text", group: "Contact" },
  { key: "legacyProfile.typePhone3", label: "Phone 3 Type", type: "text", group: "Contact" },
  { key: "legacyProfile.p3Ext", label: "Phone 3 Ext", type: "text", group: "Contact" },
  { key: "email", label: "Email", type: "text", group: "Contact" },
  { key: "legacyProfile.email2", label: "Email 2", type: "text", group: "Contact" },
  { key: "legacyProfile.emailOptOut", label: "Email Opted Out", type: "boolean", group: "Contact" },
  { key: "legacyProfile.callBack", label: "Call Back", type: "boolean", group: "Contact" },
  { key: "legacyProfile.callBackDate", label: "Call Back Date", type: "date", group: "Contact" },

  // Status & Workflow
  {
    key: "status",
    label: "Member Status",
    type: "enum",
    group: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "expired", label: "Expired" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  {
    key: "signedUpVia",
    label: "Signed Up Via",
    type: "enum",
    group: "Status",
    options: [
      { value: "web", label: "Web" },
      { value: "phone", label: "Phone" },
      { value: "admin", label: "Admin" },
    ],
  },
  { key: "legacyProfile.workbenchMemberStatus", label: "Workbench Status", type: "text", group: "Status" },
  {
    key: "legacyProfile.howJoined",
    label: "How Joined",
    type: "enum",
    group: "Status",
    options: [
      { value: "PHO", label: "PHO" },
      { value: "WEB", label: "WEB" },
      { value: "REF", label: "REF" },
      { value: "MAIL", label: "MAIL" },
    ],
  },
  {
    key: "legacyProfile.referralSource",
    label: "Referral Source",
    type: "enum",
    group: "Status",
    options: [
      { value: "CCAG", label: "CCAG" },
      { value: "MEMBER", label: "MEMBER" },
      { value: "OTHER", label: "OTHER" },
    ],
  },
  { key: "legacyProfile.referredById", label: "Referred By ID", type: "text", group: "Status" },
  { key: "legacyProfile.dateReferred", label: "Date Referred", type: "date", group: "Status" },
  { key: "legacyProfile.nextStep", label: "Next Step", type: "text", group: "Status" },
  { key: "legacyProfile.recordType", label: "Record Type", type: "text", group: "Status" },
  { key: "legacyProfile.registrationPaymentStatus", label: "Reg Payment Status", type: "text", group: "Status" },

  // Oil
  { key: "oilCompanyId._id", label: "Oil Company", type: "ref", group: "Oil" },
  { key: "legacyProfile.oilId", label: "Oil ID", type: "text", group: "Oil" },
  { key: "legacyProfile.oilStartDate", label: "Oil Start Date", type: "date", group: "Oil" },
  {
    key: "legacyProfile.oilStatus",
    label: "Oil Status",
    type: "enum",
    group: "Oil",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "PROSPECTIVE", label: "Prospective" },
      { value: "RESIDENT", label: "Resident" },
      { value: "NO OIL", label: "No Oil" },
      { value: "UNKNOWN", label: "Unknown" },
    ],
  },

  // Propane
  { key: "legacyProfile.propaneId", label: "Propane ID", type: "text", group: "Propane" },
  { key: "legacyProfile.propCoCode", label: "Propane Co Code", type: "text", group: "Propane" },
  {
    key: "legacyProfile.propaneStatus",
    label: "Propane Status",
    type: "enum",
    group: "Propane",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "PROSPECTIVE", label: "Prospective" },
      { value: "RESIDENT", label: "Resident" },
      { value: "NO PROPANE", label: "No Propane" },
      { value: "UNKNOWN", label: "Unknown" },
    ],
  },
  { key: "legacyProfile.propaneStartDate", label: "Propane Start Date", type: "date", group: "Propane" },

  // Electric
  {
    key: "legacyProfile.electricStatus",
    label: "Electric Status",
    type: "enum",
    group: "Electric",
    options: [
      { value: "ELECTRIC", label: "Electric" },
      { value: "PENDING", label: "Pending" },
      { value: "INTERESTED", label: "Interested" },
      { value: "UNKNOWN", label: "Unknown" },
      { value: "DROPPED", label: "Dropped" },
    ],
  },
  { key: "legacyProfile.electricStartDate", label: "Electric Start Date", type: "date", group: "Electric" },
  { key: "legacyProfile.electricSignUpDate", label: "Electric Sign Up Date", type: "date", group: "Electric" },
  { key: "legacyProfile.droppedDate", label: "Electric Dropped Date", type: "date", group: "Electric" },
  { key: "legacyProfile.electricAccountNumber", label: "Electric Account #", type: "text", group: "Electric" },
  { key: "legacyProfile.notPaidCurrent", label: "Not Paid Current", type: "boolean", group: "Electric" },
  { key: "legacyProfile.delinquent", label: "Delinquent", type: "boolean", group: "Electric" },
  { key: "legacyProfile.nameKey", label: "Name Key", type: "text", group: "Electric" },

  // Solar
  { key: "legacyProfile.solorReferralSentDate", label: "Solar Referral Sent Date", type: "date", group: "Solar" },
  { key: "legacyProfile.solorNotes", label: "Solar Notes", type: "text", group: "Solar" },
  { key: "legacyProfile.solorPanels", label: "Solar Panels", type: "text", group: "Solar" },
  {
    key: "legacyProfile.solorPaid",
    label: "Solar Paid",
    type: "enum",
    group: "Solar",
    options: [
      { value: "YES", label: "Yes" },
      { value: "NO", label: "No" },
    ],
  },
  { key: "legacyProfile.solorDatePaid", label: "Solar Date Paid", type: "date", group: "Solar" },

  // Energy Audit
  { key: "legacyProfile.energyAuditReferralDate", label: "Energy Audit Referral Date", type: "date", group: "Energy Audit" },
  { key: "legacyProfile.energyAuditNotes", label: "Energy Audit Notes", type: "text", group: "Energy Audit" },
  { key: "legacyProfile.energyAuditDatePaid", label: "Energy Audit Date Paid", type: "date", group: "Energy Audit" },

  // Insurance
  { key: "legacyProfile.insuranceAuditReferralDate", label: "Insurance Referral Date", type: "date", group: "Insurance" },
  { key: "legacyProfile.insuranceAuditNotes", label: "Insurance Notes", type: "text", group: "Insurance" },
  { key: "legacyProfile.insuranceDatePaid", label: "Insurance Date Paid", type: "date", group: "Insurance" },

  // Misc
  { key: "legacyProfile.employer", label: "Employer", type: "text", group: "Misc" },
  { key: "legacyProfile.company", label: "Company", type: "text", group: "Misc" },
  { key: "legacyProfile.contactNote", label: "Contact Note", type: "text", group: "Misc" },
  { key: "notes", label: "Internal Notes", type: "text", group: "Misc" },
];

export function buildFilterFields(oilCompanies: { _id: string; name: string }[]): FilterFieldDef[] {
  return STATIC_FILTER_FIELDS.map((f) => {
    if (f.key === "oilCompanyId._id") {
      return {
        ...f,
        options: oilCompanies.map((oc) => ({ value: oc._id, label: oc.name })),
      };
    }
    return f;
  });
}

export function operatorsForType(type: FilterFieldType): FilterOperator[] {
  switch (type) {
    case "text":
      return ["contains", "equals", "starts_with", "is_empty", "is_not_empty"];
    case "date":
      return ["on", "before", "after", "is_empty", "is_not_empty"];
    case "boolean":
      return ["is_true", "is_false"];
    case "enum":
      return ["is", "is_not", "is_empty", "is_not_empty"];
    case "ref":
      return ["is", "is_not", "is_empty", "is_not_empty"];
  }
}

export function operatorLabel(op: FilterOperator): string {
  switch (op) {
    case "contains": return "contains";
    case "equals": return "equals";
    case "starts_with": return "starts with";
    case "is_empty": return "is empty";
    case "is_not_empty": return "is not empty";
    case "before": return "before";
    case "after": return "after";
    case "on": return "on";
    case "is_true": return "is checked";
    case "is_false": return "is unchecked";
    case "is": return "is";
    case "is_not": return "is not";
  }
}

function getValueAtPath(member: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = member;
  for (const part of parts) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

function asTimestamp(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  const s = String(v);
  const ts = Date.parse(s);
  return Number.isNaN(ts) ? null : ts;
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function evaluateFilter(
  member: Record<string, unknown>,
  filter: MemberFilter,
  field: FilterFieldDef | undefined
): boolean {
  if (!field) return true;
  const raw = getValueAtPath(member, filter.field);
  const empty = isEmptyValue(raw);

  if (filter.operator === "is_empty") return empty;
  if (filter.operator === "is_not_empty") return !empty;

  switch (field.type) {
    case "text": {
      const text = empty ? "" : String(raw).toLowerCase();
      const target = (filter.value || "").toLowerCase().trim();
      if (filter.operator === "contains") return target ? text.includes(target) : true;
      if (filter.operator === "equals") return text === target;
      if (filter.operator === "starts_with") return target ? text.startsWith(target) : true;
      return false;
    }
    case "boolean": {
      const truthy = !!raw && raw !== "false" && raw !== 0 && raw !== "0";
      if (filter.operator === "is_true") return truthy;
      if (filter.operator === "is_false") return !truthy;
      return false;
    }
    case "enum":
    case "ref": {
      const text = empty ? "" : String(raw);
      if (filter.operator === "is") return text === filter.value;
      if (filter.operator === "is_not") return text !== filter.value;
      return false;
    }
    case "date": {
      const target = filter.value;
      if (!target) return true;
      const valueTs = asTimestamp(raw);
      const targetTs = asTimestamp(target);
      if (valueTs === null || targetTs === null) return false;
      const valueDay = startOfLocalDay(valueTs);
      const targetDay = startOfLocalDay(targetTs);
      if (filter.operator === "on") return valueDay === targetDay;
      if (filter.operator === "before") return valueDay < targetDay;
      if (filter.operator === "after") return valueDay > targetDay;
      return false;
    }
  }
}

export function filterSummary(filter: MemberFilter, field: FilterFieldDef | undefined): string {
  if (!field) return "Unknown";
  const opLabel = operatorLabel(filter.operator);
  const noValueOps: FilterOperator[] = ["is_empty", "is_not_empty", "is_true", "is_false"];
  if (noValueOps.includes(filter.operator)) return `${field.label} ${opLabel}`;
  if ((field.type === "enum" || field.type === "ref") && field.options) {
    const opt = field.options.find((o) => o.value === filter.value);
    return `${field.label} ${opLabel} ${opt ? opt.label : filter.value}`;
  }
  return `${field.label} ${opLabel} "${filter.value}"`;
}

export function encodeFilters(filters: MemberFilter[]): string {
  if (filters.length === 0) return "";
  return JSON.stringify(filters.map(({ field, operator, value }) => [field, operator, value]));
}

export function decodeFilters(encoded: string): MemberFilter[] {
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(encoded);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, idx): MemberFilter | null => {
        if (!Array.isArray(entry) || entry.length < 3) return null;
        const [field, operator, value] = entry as [unknown, unknown, unknown];
        if (typeof field !== "string" || typeof operator !== "string") return null;
        return {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          field,
          operator: operator as FilterOperator,
          value: typeof value === "string" ? value : "",
        };
      })
      .filter((f): f is MemberFilter => f !== null);
  } catch {
    return [];
  }
}

function makeFilterId(): string {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Props = {
  filters: MemberFilter[];
  onFiltersChange: (next: MemberFilter[]) => void;
  fields: FilterFieldDef[];
};

export function MemberFilterWidget({ filters, onFiltersChange, fields }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const f of fields) {
      if (!seen.has(f.group)) {
        seen.add(f.group);
        order.push(f.group);
      }
    }
    return order;
  }, [fields]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addFilter() {
    const first = fields[0];
    if (!first) return;
    const nextFilter: MemberFilter = {
      id: makeFilterId(),
      field: first.key,
      operator: operatorsForType(first.type)[0],
      value: "",
    };
    onFiltersChange([...filters, nextFilter]);
  }

  function updateFilter(id: string, patch: Partial<MemberFilter>) {
    onFiltersChange(
      filters.map((f) => {
        if (f.id !== id) return f;
        const merged = { ...f, ...patch };
        if (patch.field && patch.field !== f.field) {
          const def = fields.find((x) => x.key === patch.field);
          if (def) {
            merged.operator = operatorsForType(def.type)[0];
            merged.value = "";
          }
        }
        return merged;
      })
    );
  }

  function removeFilter(id: string) {
    onFiltersChange(filters.filter((f) => f.id !== id));
  }

  function clearAll() {
    onFiltersChange([]);
  }

  return (
    <div className="admin-wb-filter" ref={containerRef}>
      <button
        type="button"
        className={`admin-wb-filter-toggle${filters.length ? " has-filters" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Open filter builder"
      >
        Filters{filters.length ? ` (${filters.length})` : ""}
      </button>
      {filters.length > 0 && (
        <div className="admin-wb-filter-chips">
          {filters.map((f) => {
            const def = fields.find((x) => x.key === f.field);
            return (
              <span className="admin-wb-filter-chip" key={f.id}>
                <span>{filterSummary(f, def)}</span>
                <button type="button" onClick={() => removeFilter(f.id)} aria-label="Remove filter">×</button>
              </span>
            );
          })}
          <button
            type="button"
            className="admin-wb-filter-clear"
            onClick={clearAll}
            title="Remove all filters"
          >
            Clear
          </button>
        </div>
      )}
      {open && (
        <div className="admin-wb-filter-panel">
          <div className="admin-wb-filter-panel-head">
            <strong>Filters</strong>
            <span className="admin-wb-filter-panel-meta">
              {filters.length} active · all conditions must match
            </span>
          </div>
          <div className="admin-wb-filter-rows">
            {filters.length === 0 && (
              <div className="admin-wb-filter-empty">No filters yet. Add one to start.</div>
            )}
            {filters.map((f) => {
              const def = fields.find((x) => x.key === f.field);
              const ops = def ? operatorsForType(def.type) : [];
              const showValue = !["is_empty", "is_not_empty", "is_true", "is_false"].includes(f.operator);
              return (
                <div className="admin-wb-filter-row" key={f.id}>
                  <select
                    value={f.field}
                    onChange={(e) => updateFilter(f.id, { field: e.target.value })}
                    className="admin-wb-filter-select"
                  >
                    {groups.map((group) => (
                      <optgroup key={group} label={group}>
                        {fields
                          .filter((x) => x.group === group)
                          .map((x) => (
                            <option key={x.key} value={x.key}>{x.label}</option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <select
                    value={f.operator}
                    onChange={(e) => updateFilter(f.id, { operator: e.target.value as FilterOperator })}
                    className="admin-wb-filter-select"
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>{operatorLabel(op)}</option>
                    ))}
                  </select>
                  {showValue && def && (def.type === "enum" || def.type === "ref") ? (
                    <select
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                      className="admin-wb-filter-input"
                    >
                      <option value="">— select —</option>
                      {(def.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : showValue ? (
                    <input
                      type={def?.type === "date" ? "date" : "text"}
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                      placeholder="Value"
                      className="admin-wb-filter-input"
                    />
                  ) : (
                    <span className="admin-wb-filter-input admin-wb-filter-input-disabled">—</span>
                  )}
                  <button
                    type="button"
                    className="admin-wb-filter-row-remove"
                    onClick={() => removeFilter(f.id)}
                    aria-label="Remove filter"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="admin-wb-filter-foot">
            <button type="button" className="admin-wb-btn" onClick={addFilter}>+ Add filter</button>
            {filters.length > 0 && (
              <button type="button" className="admin-wb-btn" onClick={clearAll}>Clear all</button>
            )}
            <button type="button" className="admin-wb-btn admin-wb-btn-primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
