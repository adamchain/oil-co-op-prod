import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import type { WorkbenchFormState } from "../pages/AdminWorkbenchPage";
import { formatPhoneValue } from "../utils/phone";

type BillingEvent = {
  _id: string;
  kind: string;
  status: string;
  amountCents: number;
  billingYear?: number;
  createdAt: string;
  manualEntry?: boolean;
  paymentMethod?: string;
  checkNumber?: string;
  entryType?: string;
  paidDate?: string | null;
};

export type NewPaymentLine = {
  billingYear: number;
  waived: "yes" | "no" | "refund";
  paidDate?: string;
  amountCents: number;
  method: "authorize.net" | "check" | "money_order";
  type: "new" | "renew";
  checkNumber?: string;
};

const WAIVED_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "refund", label: "Refund" },
] as const;

const METHOD_OPTIONS = [
  { value: "authorize.net", label: "Authorize.Net" },
  { value: "check", label: "Check" },
  { value: "money_order", label: "Money Order" },
] as const;

const TYPE_OPTIONS = [
  { value: "renew", label: "Renew" },
  { value: "new", label: "New" },
] as const;

const methodLabel = (v: string) => METHOD_OPTIONS.find((o) => o.value === v)?.label ?? "";

// Format a typed date string into MM/DD/YYYY as the user types.
function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return [mm, dd, yyyy].filter(Boolean).join("/");
}

// Parse MM/DD/YYYY into an ISO date string; returns "" if incomplete/invalid.
function mmddyyyyToISO(value: string): string {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

// Format a typed amount into "$X.XX".
function formatAmountInput(value: string): string {
  const cents = amountToCents(value);
  if (cents === null) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

// Parse an amount string ("$25.00", "25", "25.5") into integer cents; null if empty/invalid.
function amountToCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

const OIL_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN"] as const;
const PROPANE_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO PROPANE", "UNKNOWN"] as const;
const PHONE_TYPE = ["HOME", "WORK", "CELL"] as const;
const CARD_TYPES = ["VISA", "MASTERCARD", "AMEX", "DISCOVER"] as const;

const isAmexType = (type: string) => type.trim().toUpperCase() === "AMEX";

// Format a raw card-number string into hyphenated groups (Amex = 4-6-5, others = 4-4-4-4).
function formatCardNumber(value: string, amex: boolean): string {
  const digits = value.replace(/\D/g, "").slice(0, amex ? 15 : 16);
  if (amex) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join("-");
  }
  return (digits.match(/.{1,4}/g) ?? []).join("-");
}

// Format an expiration string into MM/YY.
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type PaymentHistoryViewProps = {
  form: WorkbenchFormState;
  setForm: Dispatch<SetStateAction<WorkbenchFormState>>;
  billing: BillingEvent[];
  member?: { memberNumber?: string; createdAt?: string } | null;
  oilCompanyName?: string;
  onAddPayment?: (line: NewPaymentLine) => Promise<void>;
  onDeletePayment?: (billingId: string) => Promise<void>;
};

const emptyDraft = {
  billingYear: String(new Date().getFullYear()),
  waived: "no" as "yes" | "no" | "refund",
  paidDate: "",
  amount: "",
  method: "check" as "authorize.net" | "check" | "money_order",
  type: "renew" as "new" | "renew",
  checkNumber: "",
};

export default function PaymentHistoryView({ form, setForm, billing, member, oilCompanyName, onAddPayment, onDeletePayment }: PaymentHistoryViewProps) {
  const legacyValue = (key: string) => String(form.legacyProfile[key] ?? "");
  const legacyBool = (key: string) => Boolean(form.legacyProfile[key]);
  const setLegacy = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, legacyProfile: { ...f.legacyProfile, [key]: value } }));

  const regStatus = legacyValue("registrationPaymentStatus").toLowerCase();
  const cardType = legacyValue("ccType");
  const amex = isAmexType(cardType);
  const cvvLength = amex ? 4 : 3;

  // Switching card type re-formats the stored number and trims the security code length.
  const changeCardType = (type: string) =>
    setForm((f) => {
      const nextAmex = isAmexType(type);
      const lp = { ...f.legacyProfile };
      lp.ccType = type;
      lp.ccNumber = formatCardNumber(String(lp.ccNumber ?? ""), nextAmex);
      lp.ccCvv = String(lp.ccCvv ?? "").replace(/\D/g, "").slice(0, nextAmex ? 4 : 3);
      return { ...f, legacyProfile: lp };
    });

  const [draft, setDraft] = useState(emptyDraft);
  const [savingLine, setSavingLine] = useState(false);
  const [lineError, setLineError] = useState("");

  // Every renewal / registration / manual payment line, newest first.
  const paymentRows = useMemo(
    () =>
      billing
        .filter((b) => b.kind === "annual" || b.kind === "registration" || b.manualEntry)
        .sort((a, b) => {
          const ya = a.billingYear ?? 0;
          const yb = b.billingYear ?? 0;
          if (yb !== ya) return yb - ya;
          const da = new Date(a.paidDate || a.createdAt).getTime();
          const db = new Date(b.paidDate || b.createdAt).getTime();
          return db - da;
        }),
    [billing]
  );

  async function addLine() {
    if (!onAddPayment) return;
    const year = Number(draft.billingYear.replace(/\D/g, ""));
    const cents = amountToCents(draft.amount);
    if (!Number.isFinite(year) || year < 1900) {
      setLineError("Enter a valid year.");
      return;
    }
    if (cents === null && draft.waived === "no") {
      setLineError("Enter an amount.");
      return;
    }
    setSavingLine(true);
    setLineError("");
    try {
      await onAddPayment({
        billingYear: year,
        waived: draft.waived,
        paidDate: mmddyyyyToISO(draft.paidDate) || undefined,
        amountCents: cents ?? 0,
        method: draft.method,
        type: draft.type,
        checkNumber: draft.checkNumber.trim() || undefined,
      });
      setDraft(emptyDraft);
    } catch (e) {
      setLineError(e instanceof Error ? e.message : "Could not add payment.");
    } finally {
      setSavingLine(false);
    }
  }

  async function deleteLine(row: BillingEvent) {
    if (!onDeletePayment) return;
    const label = `${row.billingYear ?? ""} · $${(row.amountCents / 100).toFixed(2)}`.trim();
    if (!window.confirm(`Delete this payment line (${label})? This cannot be undone.`)) return;
    try {
      await onDeletePayment(row._id);
    } catch (e) {
      setLineError(e instanceof Error ? e.message : "Could not delete payment.");
    }
  }

  // Default Dt Paid to today, and Registration Fee to $10, when opening a member with none on file.
  useEffect(() => {
    if (!member?.memberNumber) return;
    setForm((f) => {
      const lp = { ...f.legacyProfile };
      let changed = false;
      if (!String(lp.regDtPaid ?? "").trim()) {
        lp.regDtPaid = todayISO();
        changed = true;
      }
      if (!String(lp.registrationFee ?? "").trim()) {
        lp.registrationFee = "$10.00";
        changed = true;
      }
      return changed ? { ...f, legacyProfile: lp } : f;
    });
  }, [member?.memberNumber, setForm]);

  return (
    <div className="admin-pay-view">
      {/* Member (left) | Payment History (center) | Status (right) */}
      <div className="admin-pay-layout">
        {/* ───────── Member (left) ───────── */}
        <div className="admin-wb-grid">
          <div className="admin-wb-panel admin-pay-member">
              <div className="admin-wb-panel-title">Member</div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-sm">
                  ID
                  <span className="admin-input admin-input-static" aria-readonly="true">
                    {member?.memberNumber || legacyValue("legacyId") || "—"}
                  </span>
                </label>
                <label className="admin-field admin-field-date">
                  New Member Dt
                  <input className="admin-input" type="date" value={legacyValue("newMemberDt")} onChange={(e) => setLegacy("newMemberDt", e.target.value)} />
                </label>
              </div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-md">
                  First Name
                  <input className="admin-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                </label>
                <label className="admin-field admin-field-md">
                  Last Name
                  <input className="admin-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </label>
              </div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-lg">
                  Full Address
                  <input className="admin-input" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} />
                </label>
              </div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-md">
                  City
                  <input className="admin-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                </label>
                <label className="admin-field admin-field-xs">
                  State
                  <input className="admin-input" maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} />
                </label>
                <label className="admin-field admin-field-sm">
                  Zip
                  <input className="admin-input" maxLength={10} value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
                </label>
              </div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-lg">
                  E Mail
                  <input className="admin-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
              </div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-phone">
                  Phone 1
                  <input
                    className="admin-input"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    onBlur={(e) => setForm((f) => ({ ...f, phone: formatPhoneValue(e.target.value) }))}
                  />
                </label>
                <label className="admin-field admin-field-sm">
                  Type
                  <select className="admin-input" value={legacyValue("typePhone1") || "HOME"} onChange={(e) => setLegacy("typePhone1", e.target.value)}>
                    {PHONE_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-phone">
                  Phone 2
                  <input
                    className="admin-input"
                    value={legacyValue("phone2")}
                    onChange={(e) => setLegacy("phone2", e.target.value)}
                    onBlur={(e) => setLegacy("phone2", formatPhoneValue(e.target.value))}
                  />
                </label>
                <label className="admin-field admin-field-sm">
                  Type
                  <select className="admin-input" value={legacyValue("typePhone2") || "HOME"} onChange={(e) => setLegacy("typePhone2", e.target.value)}>
                    {PHONE_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

            </div>
        </div>

        {/* ───────── Payment history (center, full height) ───────── */}
        <div className="admin-pay-aside">
          <div className="admin-wb-panel admin-pay-history">
            <div className="admin-wb-panel-title">Payment History</div>
            <div className="admin-table-wrap">
            <table className="admin-table admin-pay-history-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Waived</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Check #</th>
                  {onDeletePayment && <th aria-label="Delete" />}
                </tr>
              </thead>
              <tbody>
                {paymentRows.length === 0 ? (
                  <tr>
                    <td colSpan={onDeletePayment ? 8 : 7} className="admin-modal-table-empty">
                      No payments yet.
                    </td>
                  </tr>
                ) : (
                  paymentRows.map((b) => {
                    const waivedLabel = b.status === "waived" ? "Yes" : b.status === "refund" ? "Refund" : "No";
                    const method = b.paymentMethod
                      ? methodLabel(b.paymentMethod)
                      : b.status === "waived"
                        ? "—"
                        : b.status === "pending"
                          ? "Check"
                          : "Authorize.Net";
                    const typeLabel = b.entryType === "new"
                      ? "New"
                      : b.entryType === "renew"
                        ? "Renew"
                        : b.kind === "registration"
                          ? "New"
                          : "Renew";
                    return (
                      <tr key={b._id}>
                        <td>{b.billingYear ?? new Date(b.paidDate || b.createdAt).getFullYear()}</td>
                        <td>{waivedLabel}</td>
                        <td>{new Date(b.paidDate || b.createdAt).toLocaleDateString()}</td>
                        <td>{b.status === "waived" ? "—" : `$${(b.amountCents / 100).toFixed(2)}`}</td>
                        <td>{method}</td>
                        <td>{typeLabel}</td>
                        <td>{b.checkNumber || "—"}</td>
                        {onDeletePayment && (
                          <td>
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger admin-btn-xs"
                              onClick={() => void deleteLine(b)}
                            >
                              Del
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {onAddPayment && (
                <tfoot>
                  <tr className="admin-pay-add-row">
                    <td>
                      <input
                        className="admin-input"
                        inputMode="numeric"
                        placeholder="Year"
                        value={draft.billingYear}
                        onChange={(e) => setDraft((d) => ({ ...d, billingYear: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      />
                    </td>
                    <td>
                      <select
                        className="admin-input"
                        value={draft.waived}
                        onChange={(e) => setDraft((d) => ({ ...d, waived: e.target.value as typeof d.waived }))}
                      >
                        {WAIVED_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="admin-input"
                        inputMode="numeric"
                        placeholder="MM/DD/YYYY"
                        value={draft.paidDate}
                        onChange={(e) => setDraft((d) => ({ ...d, paidDate: formatDateInput(e.target.value) }))}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-input"
                        inputMode="decimal"
                        placeholder="$0.00"
                        value={draft.amount}
                        onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                        onBlur={(e) => setDraft((d) => ({ ...d, amount: formatAmountInput(e.target.value) }))}
                      />
                    </td>
                    <td>
                      <select
                        className="admin-input"
                        value={draft.method}
                        onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as typeof d.method }))}
                      >
                        {METHOD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="admin-input"
                        value={draft.type}
                        onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as typeof d.type }))}
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="admin-input"
                        placeholder="Check #"
                        value={draft.checkNumber}
                        onChange={(e) => setDraft((d) => ({ ...d, checkNumber: e.target.value }))}
                      />
                    </td>
                    {onDeletePayment && <td />}
                  </tr>
                  <tr>
                    <td colSpan={onDeletePayment ? 8 : 7} className="admin-pay-add-actions">
                      {lineError && <span className="admin-pay-add-error">{lineError}</span>}
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary admin-btn-xs"
                        onClick={() => void addLine()}
                        disabled={savingLine}
                      >
                        {savingLine ? "Adding…" : "Add payment"}
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </div>

        {/* ───────── Status (right) ───────── */}
        <div className="admin-wb-panel admin-pay-status">
          <div className="admin-wb-panel-title">Status</div>

          {/* ── OIL status + company ── */}
          <div className="admin-pay-status-label">OIL</div>
              <div className="admin-wb-status-row">
                {OIL_STATUS.map((s) => (
                  <label key={s} className={`on-${s === "ACTIVE" ? "active" : s === "INACTIVE" ? "inactive" : s === "PROSPECTIVE" ? "prospect" : s === "NO OIL" ? "noOil" : "unknown"}`}>
                    <input
                      type="radio"
                      name="pay-oil-status"
                      checked={(legacyValue("oilWorkbenchStatus") || "ACTIVE") === s}
                      onChange={() => setLegacy("oilWorkbenchStatus", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-md">
                  Company
                  <span className="admin-input admin-input-static" aria-readonly="true">{oilCompanyName || "—"}</span>
                </label>
                <label className="admin-field admin-field-sm">
                  ID#
                  <input className="admin-input" value={legacyValue("oilId")} onChange={(e) => setLegacy("oilId", e.target.value)} />
                </label>
                <label className="admin-field admin-field-date">
                  Start Date
                  <input className="admin-input" type="date" value={legacyValue("oilStartDate")} onChange={(e) => setLegacy("oilStartDate", e.target.value)} />
                </label>
              </div>

              {/* ── PROPANE status + company ── */}
              <div className="admin-pay-status-label" style={{ marginTop: "0.45rem" }}>Propane</div>
              <div className="admin-wb-status-row">
                {PROPANE_STATUS.map((s) => (
                  <label key={s} className={`on-${s === "ACTIVE" ? "active" : s === "INACTIVE" ? "inactive" : s === "PROSPECTIVE" ? "prospect" : s === "NO PROPANE" ? "noOil" : "unknown"}`}>
                    <input
                      type="radio"
                      name="pay-propane-status"
                      checked={(legacyValue("propaneStatus") || "UNKNOWN") === s}
                      onChange={() => setLegacy("propaneStatus", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-md">
                  Company
                  <input className="admin-input" value={legacyValue("propaneCompanyName")} onChange={(e) => setLegacy("propaneCompanyName", e.target.value)} />
                </label>
                <label className="admin-field admin-field-sm">
                  ID#
                  <input className="admin-input" value={legacyValue("propaneId")} onChange={(e) => setLegacy("propaneId", e.target.value)} />
                </label>
                <label className="admin-field admin-field-date">
                  Start Date
                  <input className="admin-input" type="date" value={legacyValue("propaneStartDate")} onChange={(e) => setLegacy("propaneStartDate", e.target.value)} />
                </label>
              </div>

              {/* Membership tiers — mirror the main dashboard view (same legacy keys, saved globally) */}
              <div className="admin-pay-status-label" style={{ marginTop: "0.45rem" }}>Membership</div>
              <div className="admin-checkbox-grid admin-pay-flags">
                <label>
                  <input type="checkbox" checked={legacyBool("standardMembership")} onChange={(e) => setLegacy("standardMembership", e.target.checked)} />
                  Standard
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("seniorMember")} onChange={(e) => setLegacy("seniorMember", e.target.checked)} />
                  Senior
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("lowVolume")} onChange={(e) => setLegacy("lowVolume", e.target.checked)} />
                  Low Volume
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("waiveFeeLifetime")} onChange={(e) => setLegacy("waiveFeeLifetime", e.target.checked)} />
                  Lifetime
                </label>
              </div>

              <div className="admin-pay-status-label" style={{ marginTop: "0.45rem" }}>Flags</div>
              <div className="admin-checkbox-grid admin-pay-flags">
                <label>
                  <input type="checkbox" checked={legacyBool("delinquent")} onChange={(e) => setLegacy("delinquent", e.target.checked)} />
                  Delinquent
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("noRecentDels")} onChange={(e) => setLegacy("noRecentDels", e.target.checked)} />
                  No Recent Dels
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("deliveryHistory")} onChange={(e) => setLegacy("deliveryHistory", e.target.checked)} />
                  Delivery History
                </label>
                <label>
                  <input type="checkbox" checked={legacyBool("notPaidCurrentYr")} onChange={(e) => setLegacy("notPaidCurrentYr", e.target.checked)} />
                  Not Paid Current Yr
                </label>
              </div>
        </div>

        {/* ───────── Registration + credit card (below member) ───────── */}
        <div className="admin-pay-bottom">
          <div className="admin-wb-panel admin-pay-compact">
            <div className="admin-wb-panel-title">Registration</div>
            <div className="admin-form-row-wrap">
              <label className="admin-field admin-field-sm">
                Registration Fee
                <input className="admin-input" value={legacyValue("registrationFee")} onChange={(e) => setLegacy("registrationFee", e.target.value)} />
              </label>
              <label className="admin-field admin-field-date">
                Dt Paid
                <input className="admin-input" type="date" value={legacyValue("regDtPaid")} onChange={(e) => setLegacy("regDtPaid", e.target.value)} />
              </label>
              <label className="admin-field admin-field-sm">
                Check / Credit
                <select className="admin-input" value={legacyValue("regCheckCredit")} onChange={(e) => setLegacy("regCheckCredit", e.target.value)}>
                  <option value="">—</option>
                  <option value="Check">Check</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </label>
            </div>
            <div className="admin-form-row-wrap">
              <div className="admin-checkbox-grid admin-pay-flags" style={{ paddingBottom: "0.14rem" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={regStatus === "paid"}
                    onChange={(e) => setLegacy("registrationPaymentStatus", e.target.checked ? "paid" : "")}
                  />
                  Registration Paid
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={regStatus === "waived"}
                    onChange={(e) => setLegacy("registrationPaymentStatus", e.target.checked ? "waived" : "")}
                  />
                  Registration Waived
                </label>
              </div>
            </div>
            <div className="admin-form-row-wrap">
              <label className="admin-field admin-field-lg">
                Payment Notes
                <textarea
                  className="admin-input"
                  rows={2}
                  value={legacyValue("paymentNotes")}
                  onChange={(e) => setLegacy("paymentNotes", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="admin-wb-panel admin-pay-compact">
            <div className="admin-wb-panel-title">Credit Card</div>
            <div className="admin-form-row-wrap">
              <label className="admin-field admin-field-sm">
                Card Type
                <select className="admin-input" value={cardType} onChange={(e) => changeCardType(e.target.value)}>
                  <option value="">—</option>
                  {CARD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field admin-field-card">
                Card Number
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={amex ? "••••-••••••-•••••" : "••••-••••-••••-••••"}
                  value={legacyValue("ccNumber")}
                  onChange={(e) => setLegacy("ccNumber", formatCardNumber(e.target.value, amex))}
                />
              </label>
              <label className="admin-field admin-field-exp">
                Exp
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="MM/YY"
                  value={legacyValue("ccExp")}
                  onChange={(e) => setLegacy("ccExp", formatExpiry(e.target.value))}
                />
              </label>
              <label className="admin-field admin-field-cvv">
                {amex ? "CID" : "CVV"}
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={cvvLength}
                  placeholder={amex ? "••••" : "•••"}
                  value={legacyValue("ccCvv")}
                  onChange={(e) => setLegacy("ccCvv", e.target.value.replace(/\D/g, "").slice(0, cvvLength))}
                />
              </label>
              <label className="admin-field admin-field-md">
                Name on Card
                <input className="admin-input" value={legacyValue("ccName")} onChange={(e) => setLegacy("ccName", e.target.value)} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
