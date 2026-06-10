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

  const annualRows = useMemo(
    () =>
      billing
        .filter((b) => b.kind === "annual")
        .sort((a, b) => (b.billingYear ?? 0) - (a.billingYear ?? 0)),
    [billing]
  );

  return (
    <div className="admin-wb-grid">
      {/* ───────── Left column: record context + registration ───────── */}
      <div className="admin-wb-col">
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
            <label className="admin-field admin-field-sm">
              Cluster
              <input className="admin-input" value={legacyValue("cluster")} onChange={(e) => setLegacy("cluster", e.target.value)} />
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
          </div>

          <div className="admin-form-row-wrap">
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

          <div className="admin-form-row-wrap">
            <label className="admin-field admin-field-md">
              Oil Co
              <span className="admin-input admin-input-static" aria-readonly="true">{oilCompanyName || "—"}</span>
            </label>
            <label className="admin-field admin-field-sm">
              Oil ID
              <input className="admin-input" value={legacyValue("oilId")} onChange={(e) => setLegacy("oilId", e.target.value)} />
            </label>
            <label className="admin-field admin-field-sm">
              Propane ID
              <input className="admin-input" value={legacyValue("propaneId")} onChange={(e) => setLegacy("propaneId", e.target.value)} />
            </label>
          </div>
        </div>

        <div className="admin-wb-panel">
          <div className="admin-wb-panel-title">Status</div>
          <div className="admin-pay-status-grid">
            <div>
              <div className="admin-pay-status-label">Oil</div>
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
            </div>
            <div>
              <div className="admin-pay-status-label">Propane</div>
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
            </div>
          </div>

          <div className="admin-checkbox-grid admin-pay-flags">
            <label>
              <input type="checkbox" checked={legacyBool("waiveFeeYear")} onChange={(e) => setLegacy("waiveFeeYear", e.target.checked)} />
              Waive fee for year
            </label>
            <label>
              <input type="checkbox" checked={legacyBool("seniorMember")} onChange={(e) => setLegacy("seniorMember", e.target.checked)} />
              Senior
            </label>
            <label>
              <input type="checkbox" checked={legacyBool("waiveFeeLifetime")} onChange={(e) => setLegacy("waiveFeeLifetime", e.target.checked)} />
              Lifetime Member
            </label>
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
          </div>
        </div>

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
          </div>
          <div className="admin-checkbox-grid admin-pay-flags">
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
            <label>
              <input type="checkbox" checked={legacyBool("notPaidCurrentYr")} onChange={(e) => setLegacy("notPaidCurrentYr", e.target.checked)} />
              Not Paid Current Yr
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

        <div className="admin-wb-panel">
          <div className="admin-wb-panel-title">Credit Card</div>
          <div className="admin-form-row-wrap">
            <label className="admin-field admin-field-sm">
              Card Type
              <input className="admin-input" value={legacyValue("ccType")} onChange={(e) => setLegacy("ccType", e.target.value)} />
            </label>
            <label className="admin-field admin-field-md">
              Card Number
              <input className="admin-input" value={legacyValue("ccNumber")} onChange={(e) => setLegacy("ccNumber", e.target.value)} />
            </label>
            <label className="admin-field admin-field-sm">
              Expiration
              <input className="admin-input" value={legacyValue("ccExp")} onChange={(e) => setLegacy("ccExp", e.target.value)} />
            </label>
          </div>
          <label className="admin-field admin-field-block">
            Name on Card
            <input className="admin-input" value={legacyValue("ccName")} onChange={(e) => setLegacy("ccName", e.target.value)} />
          </label>
        </div>
      </div>

      {/* ───────── Right column: renewal fee history ───────── */}
      <div className="admin-wb-col">
        <div className="admin-wb-panel">
          <div className="admin-wb-panel-title">Renewal Fee History</div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Billing Year</th>
                  <th>Fee Waived</th>
                  <th>Date Received</th>
                  <th>Amount Received</th>
                  <th>Payment Method</th>
                  <th>New / Renew</th>
                  <th>Check Number</th>
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
