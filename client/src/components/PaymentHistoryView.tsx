import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type { WorkbenchFormState } from "../pages/AdminWorkbenchPage";

type BillingEvent = {
  _id: string;
  kind: string;
  status: string;
  amountCents: number;
  billingYear?: number;
  createdAt: string;
};

const OIL_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN"] as const;
const PROPANE_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO PROPANE", "UNKNOWN"] as const;
const PHONE_TYPE = ["HOME", "WORK", "CELL"] as const;
const CARD_TYPES = ["VISA", "MASTERCARD", "AMEX", "DISCOVER"] as const;

const isAmexType = (type: string) => type.trim().toUpperCase() === "AMEX";

// Format a raw card-number string into spaced groups (Amex = 4-6-5, others = 4-4-4-4).
function formatCardNumber(value: string, amex: boolean): string {
  const digits = value.replace(/\D/g, "").slice(0, amex ? 15 : 16);
  if (amex) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ");
  }
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}

// Format an expiration string into MM/YY.
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

type PaymentHistoryViewProps = {
  form: WorkbenchFormState;
  setForm: Dispatch<SetStateAction<WorkbenchFormState>>;
  billing: BillingEvent[];
  member?: { memberNumber?: string; createdAt?: string } | null;
  oilCompanyName?: string;
};

export default function PaymentHistoryView({ form, setForm, billing, member, oilCompanyName }: PaymentHistoryViewProps) {
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

  const annualRows = useMemo(
    () =>
      billing
        .filter((b) => b.kind === "annual")
        .sort((a, b) => (b.billingYear ?? 0) - (a.billingYear ?? 0)),
    [billing]
  );

  return (
    <div className="admin-pay-view">
      {/* Left column (member/status + registration + card) with the renewal
          history table pinned to the right. */}
      <div className="admin-pay-layout">
        <div className="admin-pay-main">
          {/* ───────── Member (left) + Status (right) ───────── */}
          <div className="admin-wb-grid">
            <div className="admin-wb-panel">
              <div className="admin-wb-panel-title">Member</div>

              <div className="admin-form-row-wrap">
                <label className="admin-field admin-field-sm">
                  ID
                  <span className="admin-input admin-input-static" aria-readonly="true">
                    {member?.memberNumber || legacyValue("legacyId") || "—"}
                  </span>
                </label>
                <label className="admin-field admin-field-md">
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
                <label className="admin-field admin-field-md">
                  Phone 1
                  <input className="admin-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </label>
                <label className="admin-field admin-field-sm">
                  Type
                  <select className="admin-input" value={legacyValue("typePhone1") || "HOME"} onChange={(e) => setLegacy("typePhone1", e.target.value)}>
                    {PHONE_TYPE.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field admin-field-md">
                  Phone 2
                  <input className="admin-input" value={legacyValue("phone2")} onChange={(e) => setLegacy("phone2", e.target.value)} />
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

            <div className="admin-wb-panel">
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
                <label className="admin-field admin-field-md">
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
                <label className="admin-field admin-field-md">
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
          </div>

          {/* ───────── Registration (full width) ───────── */}
          <div className="admin-wb-panel">
            <div className="admin-wb-panel-title">Registration</div>
            <div className="admin-form-row-wrap">
              <label className="admin-field admin-field-sm">
                Registration Fee
                <input className="admin-input" value={legacyValue("registrationFee")} onChange={(e) => setLegacy("registrationFee", e.target.value)} />
              </label>
              <label className="admin-field admin-field-md">
                Dt Paid
                <input className="admin-input" type="date" value={legacyValue("regDtPaid")} onChange={(e) => setLegacy("regDtPaid", e.target.value)} />
              </label>
              <label className="admin-field admin-field-sm">
                Check / Credit
                <input className="admin-input" value={legacyValue("regCheckCredit")} onChange={(e) => setLegacy("regCheckCredit", e.target.value)} />
              </label>
              <div className="admin-checkbox-grid admin-pay-flags" style={{ alignSelf: "flex-end", paddingBottom: "0.14rem" }}>
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
              <label className="admin-field admin-field-block">
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

          {/* ───────── Credit Card (full width) ───────── */}
          <div className="admin-wb-panel">
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
              <label className="admin-field admin-field-md">
                Card Number
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder={amex ? "•••• •••••• •••••" : "•••• •••• •••• ••••"}
                  value={legacyValue("ccNumber")}
                  onChange={(e) => setLegacy("ccNumber", formatCardNumber(e.target.value, amex))}
                />
              </label>
              <label className="admin-field admin-field-xs">
                Exp
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  value={legacyValue("ccExp")}
                  onChange={(e) => setLegacy("ccExp", formatExpiry(e.target.value))}
                />
              </label>
              <label className="admin-field admin-field-xs">
                {amex ? "CID" : "CVV"}
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="cc-csc"
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

        {/* ───────── Renewal fee history (right of member/status) ───────── */}
        <div className="admin-wb-panel admin-pay-history">
          <div className="admin-wb-panel-title">Renewal Fee History</div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Waived</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Check #</th>
                </tr>
              </thead>
              <tbody>
                {annualRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-modal-table-empty">
                      No renewal payments yet.
                    </td>
                  </tr>
                ) : (
                  annualRows.map((b) => (
                    <tr key={b._id}>
                      <td>{b.billingYear ?? new Date(b.createdAt).getFullYear()}</td>
                      <td>{b.status === "waived" ? "Yes" : "No"}</td>
                      <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td>{b.status === "waived" ? "—" : `$${(b.amountCents / 100).toFixed(2)}`}</td>
                      <td>{b.status === "waived" ? "—" : b.status === "pending" ? "CHECK" : "CARD"}</td>
                      <td>Renew</td>
                      <td>—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
