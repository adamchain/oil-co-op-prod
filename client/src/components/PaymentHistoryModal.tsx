import { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";

type BillingEvent = {
  _id: string;
  kind: string;
  status: string;
  amountCents: number;
  billingYear?: number;
  createdAt: string;
};

type PaymentMemberSnapshot = {
  memberNumber?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  typePhone1?: string;
  typePhone2?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  oilCompanyName?: string;
  oilId?: string;
  propaneId?: string;
  registrationFee?: string;
  regDtPaid?: string;
  regCheckCredit?: string;
  registrationPaymentStatus?: string;
  ccType?: string;
  ccLast4?: string;
  ccExp?: string;
  ccName?: string;
  deliveryHistory?: boolean;
  delinquent?: boolean;
  notPaidCurrentYr?: boolean;
};

type PaymentHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  member?: PaymentMemberSnapshot;
  billing: BillingEvent[];
};

export default function PaymentHistoryModal({ open, onClose, member, billing }: PaymentHistoryModalProps) {
  const titleId = useId();

  const annualRows = useMemo(
    () =>
      billing
        .filter((b) => b.kind === "annual")
        .sort((a, b) => (b.billingYear ?? 0) - (a.billingYear ?? 0)),
    [billing]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const node = (
    <div
      className="admin-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-panel-head">
          <h2 id={titleId}>Payment history</h2>
          <div className="admin-modal-panel-actions">
            <button type="button" className="admin-btn admin-btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="admin-modal-body-grid">
          <div className="admin-modal-stack">
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>ID</span>
                <input className="admin-input" readOnly value={member?.memberNumber || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>New member date</span>
                <input
                  className="admin-input"
                  readOnly
                  value={member?.createdAt ? new Date(member.createdAt).toLocaleDateString() : ""}
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>First name</span>
                <input className="admin-input" readOnly value={member?.firstName || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Last name</span>
                <input className="admin-input" readOnly value={member?.lastName || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field">
              <span>Full address</span>
              <input
                className="admin-input"
                readOnly
                value={[member?.addressLine1, member?.addressLine2].filter(Boolean).join(", ")}
                style={{ width: "100%", minWidth: 0 }}
              />
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>City / State / Zip</span>
                <input className="admin-input" readOnly value={[member?.city, member?.state, member?.postalCode].filter(Boolean).join(" ")} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Email</span>
                <input className="admin-input" readOnly value={member?.email || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>Phone 1 ({member?.typePhone1 || "HOME"})</span>
                <input className="admin-input" readOnly value={member?.phone || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Phone 2 ({member?.typePhone2 || "HOME"})</span>
                <input className="admin-input" readOnly value={member?.phone2 || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>Oil co</span>
                <input className="admin-input" readOnly value={member?.oilCompanyName || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Oil ID</span>
                <input className="admin-input" readOnly value={member?.oilId || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>Propane ID</span>
                <input className="admin-input" readOnly value={member?.propaneId || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Registration fee</span>
                <input className="admin-input" readOnly value={member?.registrationFee || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>Registration paid date</span>
                <input className="admin-input" readOnly value={member?.regDtPaid || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Check/Credit</span>
                <input className="admin-input" readOnly value={member?.regCheckCredit || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>Registration status</span>
                <input className="admin-input" readOnly value={member?.registrationPaymentStatus || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Card type</span>
                <input className="admin-input" readOnly value={member?.ccType || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field-row">
              <div className="admin-modal-field">
                <span>Card last 4</span>
                <input className="admin-input" readOnly value={member?.ccLast4 || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
              <div className="admin-modal-field">
                <span>Card expiry</span>
                <input className="admin-input" readOnly value={member?.ccExp || ""} style={{ width: "100%", minWidth: 0 }} />
              </div>
            </div>
            <div className="admin-modal-field">
              <span>Name on card</span>
              <input className="admin-input" readOnly value={member?.ccName || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>
            <div className="admin-checkbox-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <label>
                <input type="checkbox" checked={Boolean(member?.deliveryHistory)} readOnly />
                Delivery history
              </label>
              <label>
                <input type="checkbox" checked={Boolean(member?.delinquent)} readOnly />
                Delinquent
              </label>
              <label>
                <input type="checkbox" checked={Boolean(member?.notPaidCurrentYr)} readOnly />
                Not paid current year
              </label>
            </div>
          </div>

          <div className="admin-modal-stack">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Billing year</th>
                    <th>Fee waived</th>
                    <th>Date received</th>
                    <th>Amount received</th>
                    <th>Payment method</th>
                    <th>New / Renew</th>
                    <th>Ref / Check</th>
                  </tr>
                </thead>
                <tbody>
                  {annualRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-modal-table-empty">
                        No annual payment rows yet.
                      </td>
                    </tr>
                  ) : (
                    annualRows.map((b) => (
                      <tr key={b._id}>
                        <td>{b.billingYear ?? new Date(b.createdAt).getFullYear()}</td>
                        <td>{b.status === "waived" ? "Yes" : "No"}</td>
                        <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                        <td>${(b.amountCents / 100).toFixed(2)}</td>
                        <td>{b.status === "pending" ? "CHECK" : "CARD"}</td>
                        <td>Renew</td>
                        <td>{b.status.toUpperCase()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
