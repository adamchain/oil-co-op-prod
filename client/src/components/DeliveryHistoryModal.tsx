import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

const OIL_STATUS = ["ACTIVE", "INACTIVE", "PROSPECTIVE", "RESIDENT", "NO OIL", "UNKNOWN"] as const;
const PROP_STATUS = ["ACTIVE", "INACTIVE", "NO PROPANE", "PROSPECTIVE", "RESIDENT", "UNKNOWN"] as const;

type DeliveryHistoryRow = {
  dateDelivered: string;
  deliveryYear: number;
  fuelType: "OIL" | "PROPANE";
  gallons: number;
};

type DeliveryMemberSnapshot = {
  memberNumber?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  oilCoCode?: string;
  oilCompanyName?: string;
  oilId?: string;
  oilStatus?: string;
  propCoCode?: string;
  propaneCompanyName?: string;
  propaneId?: string;
  propaneStatus?: string;
  deliveryHistory?: boolean;
  delinquent?: boolean;
  notPaidCurrentYr?: boolean;
  noRecentDels?: boolean;
};

export type DeliveryHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  member?: DeliveryMemberSnapshot;
  deliveries?: DeliveryHistoryRow[];
};

/**
 * Delivery history dialog using the same admin UI as the rest of the app.
 * Fields and grid stay empty until mock/API data is wired in.
 */
export default function DeliveryHistoryModal({ open, onClose, member, deliveries = [] }: DeliveryHistoryModalProps) {
  const titleId = useId();
  const formatDeliveryDate = (raw: string) => {
    const d = new Date(raw);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString(undefined, { month: "long" }).toUpperCase();
    return `${day}-${month}`;
  };

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
          <h2 id={titleId}>Delivery history</h2>
          <div className="admin-modal-panel-actions">
            <button type="button" className="admin-btn" onClick={() => undefined}>
              Find
            </button>
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
                  placeholder="MM/DD/YYYY"
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
              <span>Oil co code</span>
              <input className="admin-input" readOnly value={member?.oilCoCode || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>
            <div className="admin-modal-field">
              <span>Oil company name</span>
              <input className="admin-input" readOnly value={member?.oilCompanyName || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>
            <div className="admin-modal-field">
              <span>Oil ID</span>
              <input className="admin-input" readOnly value={member?.oilId || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>

            <div className="admin-modal-field">
              <span>Oil status</span>
              <div className="admin-modal-radio-grid">
                {OIL_STATUS.map((s) => (
                  <label key={s}>
                    <input type="radio" name="dh-oil-st" disabled checked={(member?.oilStatus || "UNKNOWN") === s} readOnly />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-modal-field">
              <span>Propane co code</span>
              <input className="admin-input" readOnly value={member?.propCoCode || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>
            <div className="admin-modal-field">
              <span>Propane company name</span>
              <input className="admin-input" readOnly value={member?.propaneCompanyName || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>
            <div className="admin-modal-field">
              <span>Propane ID</span>
              <input className="admin-input" readOnly value={member?.propaneId || ""} style={{ width: "100%", minWidth: 0 }} />
            </div>

            <div className="admin-modal-field">
              <span>Propane status</span>
              <div className="admin-modal-radio-grid">
                {PROP_STATUS.map((s) => (
                  <label key={s}>
                    <input type="radio" name="dh-prop-st" disabled checked={(member?.propaneStatus || "UNKNOWN") === s} readOnly />
                    {s}
                  </label>
                ))}
              </div>
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
              <label>
                <input type="checkbox" checked={Boolean(member?.noRecentDels)} readOnly />
                No recent deliveries
              </label>
            </div>

            <p className="admin-modal-hint">Ctrl+Delete removes the selected delivery row when editing is enabled.</p>
          </div>

          <div className="admin-modal-stack">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date delivered</th>
                    <th>Delivery year</th>
                    <th>Oil / propane</th>
                    <th>Gallons</th>
                    <th aria-label="Delete" />
                  </tr>
                </thead>
                <tbody>
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-modal-table-empty">
                        No deliveries loaded yet.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((row, idx) => (
                      <tr key={`${row.dateDelivered}-${row.deliveryYear}-${idx}`}>
                        <td>{formatDeliveryDate(row.dateDelivered)}</td>
                        <td>{row.deliveryYear}</td>
                        <td>{row.fuelType}</td>
                        <td>{row.gallons.toFixed(1)}</td>
                        <td>
                          <button type="button" className="admin-btn admin-btn-ghost" disabled>
                            DEL
                          </button>
                        </td>
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
