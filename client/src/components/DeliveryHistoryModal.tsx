import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const OIL_STATUS = ["ACTIVE", "PROSPECTIVE", "NO OIL", "INACTIVE", "RESIDENT", "UNKNOWN"] as const;
const PROP_STATUS = ["ACTIVE", "NO PROPANE", "RESIDENT", "INACTIVE", "PROSPECTIVE", "UNKNOWN"] as const;

type DeliveryHistoryRow = {
  _id?: string;
  dateDelivered: string;
  deliveryYear: number;
  fuelType: "OIL" | "PROPANE";
  gallons: number;
  source?: "manual" | "import" | "legacy";
};

export type DeliveryRowDraft = {
  dateDelivered: string;
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

export type DeliveryMemberPatch = Partial<Omit<DeliveryMemberSnapshot, "memberNumber" | "createdAt">>;

export type DeliveryHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  member?: DeliveryMemberSnapshot;
  deliveries?: DeliveryHistoryRow[];
  searchableMembers?: Array<{
    _id: string;
    memberNumber?: string;
    firstName?: string;
    lastName?: string;
    legacyProfile?: Record<string, unknown>;
  }>;
  onMemberPatch?: (patch: DeliveryMemberPatch) => void;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void | Promise<void>;
  /**
   * Manual CRUD callbacks for delivery rows. When provided, the modal renders
   * Add/Edit/Delete affordances on the deliveries grid and calls these to
   * persist. The parent should perform the API call and return the canonical
   * updated row list which the modal will use to refresh the grid.
   */
  onAddDelivery?: (draft: DeliveryRowDraft) => Promise<DeliveryHistoryRow[] | void> | DeliveryHistoryRow[] | void;
  onUpdateDelivery?: (rowId: string, draft: DeliveryRowDraft) => Promise<DeliveryHistoryRow[] | void> | DeliveryHistoryRow[] | void;
  onDeleteDelivery?: (rowId: string) => Promise<DeliveryHistoryRow[] | void> | DeliveryHistoryRow[] | void;
};

/**
 * Delivery history dialog using the same admin UI as the rest of the app.
 * Fields and grid stay empty until mock/API data is wired in.
 */
export default function DeliveryHistoryModal({
  open,
  onClose,
  member,
  deliveries = [],
  searchableMembers = [],
  onMemberPatch,
  isDirty = false,
  isSaving = false,
  onSave,
  onAddDelivery,
  onUpdateDelivery,
  onDeleteDelivery,
}: DeliveryHistoryModalProps) {
  const titleId = useId();
  const [findYear, setFindYear] = useState(() => String(new Date().getFullYear()));
  const [findMonth, setFindMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [findDay, setFindDay] = useState("");
  const [findFuel, setFindFuel] = useState<"" | "OIL" | "PROPANE">("");
  const [findTriggered, setFindTriggered] = useState(false);
  const [selectedFindMemberId, setSelectedFindMemberId] = useState<string | null>(null);

  // Local override of deliveries used after CRUD ops. Falls back to props.
  const [rowsOverride, setRowsOverride] = useState<DeliveryHistoryRow[] | null>(null);
  // Inline editor state.
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [rowDraft, setRowDraft] = useState<{ year: string; month: string; day: string; fuelType: "OIL" | "PROPANE"; gallons: string }>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1).padStart(2, "0"),
    day: "01",
    fuelType: "OIL",
    gallons: "",
  });
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState(false);

  const formatDeliveryDate = (raw: string) => {
    const d = new Date(raw);
    const month = d.toLocaleDateString(undefined, { month: "long" }).toUpperCase();
    const year = d.getFullYear();
    return `${month} ${year}`;
  };

  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const parseRowsFromLegacy = (raw: unknown): DeliveryHistoryRow[] => {
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
        return { dateDelivered, deliveryYear, fuelType, gallons };
      })
      .filter((v): v is DeliveryHistoryRow => Boolean(v));
  };

  const findSelectedMember = useMemo(
    () => (selectedFindMemberId ? searchableMembers.find((m) => m._id === selectedFindMemberId) || null : null),
    [selectedFindMemberId, searchableMembers]
  );

  const isViewingFind = Boolean(findSelectedMember);

  const displayedMember = useMemo<DeliveryMemberSnapshot | undefined>(() => {
    if (!findSelectedMember) return member;
    const lp = (findSelectedMember.legacyProfile || {}) as Record<string, unknown>;
    return {
      memberNumber: findSelectedMember.memberNumber || "",
      createdAt: undefined,
      firstName: findSelectedMember.firstName || "",
      lastName: findSelectedMember.lastName || "",
      oilCoCode: String(lp.oilCoCode || ""),
      oilCompanyName: String(lp.oilCompanyName || ""),
      oilId: String(lp.oilId || ""),
      oilStatus: String(lp.oilWorkbenchStatus || lp.workbenchMemberStatus || "UNKNOWN"),
      propCoCode: String(lp.propCoCode || ""),
      propaneCompanyName: String(lp.propaneCompanyName || ""),
      propaneId: String(lp.propaneId || ""),
      propaneStatus: String(lp.propaneStatus || "UNKNOWN"),
      deliveryHistory: Boolean(lp.deliveryHistory),
      delinquent: Boolean(lp.delinquent),
      notPaidCurrentYr: Boolean(lp.notPaidCurrentYr),
      noRecentDels: Boolean(lp.noRecentDels),
    };
  }, [findSelectedMember, member]);

  const displayedDeliveries = useMemo<DeliveryHistoryRow[]>(() => {
    if (findSelectedMember) {
      return parseRowsFromLegacy((findSelectedMember.legacyProfile || {}).deliveryHistoryRows);
    }
    return rowsOverride ?? deliveries;
  }, [findSelectedMember, deliveries, rowsOverride]);

  // Editing only flows through to the workbench when we're viewing the original member.
  const editable = Boolean(onMemberPatch) && !isViewingFind;
  const [draft, setDraft] = useState<DeliveryMemberSnapshot>(() => displayedMember || {});

  useEffect(() => {
    setDraft(displayedMember || {});
  }, [displayedMember?.memberNumber, open]);

  // Reset find selection / row override when the modal closes or the underlying member changes.
  useEffect(() => {
    if (!open) {
      setSelectedFindMemberId(null);
      setFindTriggered(false);
      setEditingRowId(null);
      setAdding(false);
      setRowsOverride(null);
      setRowError(null);
    }
  }, [open]);

  useEffect(() => {
    setSelectedFindMemberId(null);
    setRowsOverride(null);
    setEditingRowId(null);
    setAdding(false);
  }, [member?.memberNumber]);

  // When parent passes a fresh deliveries array, clear our override so we display canonical data.
  useEffect(() => {
    setRowsOverride(null);
  }, [deliveries]);

  const patch = (next: DeliveryMemberPatch) => {
    setDraft((prev) => ({ ...prev, ...next }));
    if (editable) onMemberPatch?.(next);
  };

  const rowsEditable = !isViewingFind && Boolean(onAddDelivery || onUpdateDelivery || onDeleteDelivery);

  const resetDraftForAdd = () => {
    const now = new Date();
    setRowDraft({
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, "0"),
      day: String(now.getDate()).padStart(2, "0"),
      fuelType: "OIL",
      gallons: "",
    });
  };

  const beginAdd = () => {
    if (!onAddDelivery) return;
    setEditingRowId(null);
    resetDraftForAdd();
    setAdding(true);
    setRowError(null);
  };

  const beginEdit = (row: DeliveryHistoryRow) => {
    if (!onUpdateDelivery || !row._id) return;
    setAdding(false);
    setEditingRowId(row._id);
    setRowDraft({
      year: row.dateDelivered.slice(0, 4),
      month: row.dateDelivered.slice(5, 7),
      day: row.dateDelivered.slice(8, 10),
      fuelType: row.fuelType,
      gallons: String(row.gallons),
    });
    setRowError(null);
  };

  const cancelRowEdit = () => {
    setEditingRowId(null);
    setAdding(false);
    setRowError(null);
  };

  const validateAndBuildDraft = (): DeliveryRowDraft | null => {
    const y = Number(rowDraft.year);
    const m = Number(rowDraft.month);
    const d = Number(rowDraft.day);
    const g = Number(rowDraft.gallons);
    if (!Number.isFinite(y) || y < 1900 || y > 2200) {
      setRowError("Year must be a 4-digit number");
      return null;
    }
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      setRowError("Month must be 1–12");
      return null;
    }
    if (!Number.isFinite(d) || d < 1 || d > 31) {
      setRowError("Day must be 1–31");
      return null;
    }
    if (!Number.isFinite(g) || g < 0) {
      setRowError("Gallons must be a non-negative number");
      return null;
    }
    return {
      dateDelivered: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      fuelType: rowDraft.fuelType,
      gallons: g,
    };
  };

  const handleSaveRow = async () => {
    const built = validateAndBuildDraft();
    if (!built) return;
    setRowBusy(true);
    setRowError(null);
    try {
      let result: DeliveryHistoryRow[] | void;
      if (adding && onAddDelivery) result = await onAddDelivery(built);
      else if (editingRowId && onUpdateDelivery) result = await onUpdateDelivery(editingRowId, built);
      else return;
      if (Array.isArray(result)) setRowsOverride(result);
      setEditingRowId(null);
      setAdding(false);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setRowBusy(false);
    }
  };

  const handleDeleteRow = async (row: DeliveryHistoryRow) => {
    if (!onDeleteDelivery || !row._id) return;
    if (!window.confirm(`Delete this ${row.fuelType.toLowerCase()} delivery (${row.gallons.toFixed(1)} gal)?`)) return;
    setRowBusy(true);
    setRowError(null);
    try {
      const result = await onDeleteDelivery(row._id);
      if (Array.isArray(result)) setRowsOverride(result);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setRowBusy(false);
    }
  };
  const findResults = useMemo(() => {
    if (!findTriggered) return [];
    const yearNum = Number(findYear);
    const monthNum = Number(findMonth);
    const dayNum = findDay ? Number(findDay) : NaN;
    const hasYear = Number.isFinite(yearNum) && yearNum > 0;
    const hasMonth = Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12;
    const hasDay = Number.isFinite(dayNum) && dayNum >= 1 && dayNum <= 31;
    if (!hasYear && !hasMonth && !hasDay && !findFuel) return [];
    return searchableMembers
      .map((m) => {
        const rows = parseRowsFromLegacy((m.legacyProfile || {}).deliveryHistoryRows);
        const matches = rows.filter((row) => {
          const d = new Date(row.dateDelivered);
          if (hasYear && d.getFullYear() !== yearNum) return false;
          if (hasMonth && d.getMonth() + 1 !== monthNum) return false;
          if (hasDay && d.getDate() !== dayNum) return false;
          if (findFuel && row.fuelType !== findFuel) return false;
          return true;
        });
        if (matches.length === 0) return null;
        return {
          id: m._id,
          memberNumber: m.memberNumber || "",
          name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown",
          deliveries: matches.length,
          gallons: matches.reduce((sum, row) => sum + row.gallons, 0),
        };
      })
      .filter((v): v is { id: string; memberNumber: string; name: string; deliveries: number; gallons: number } => Boolean(v))
      .sort((a, b) => b.deliveries - a.deliveries || a.name.localeCompare(b.name));
  }, [findTriggered, findMonth, findYear, findDay, findFuel, searchableMembers]);

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
        className="admin-modal-panel admin-modal-panel-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-panel-head">
          <h2 id={titleId}>
            Delivery history
            {isViewingFind && (
              <>
                {" — "}
                <span className="admin-modal-find-viewing">
                  Viewing: {`${displayedMember?.firstName || ""} ${displayedMember?.lastName || ""}`.trim() || displayedMember?.memberNumber || "—"}
                </span>
              </>
            )}
          </h2>
          <div className="admin-modal-panel-actions">
            {isViewingFind && (
              <button
                type="button"
                className="admin-btn"
                onClick={() => setSelectedFindMemberId(null)}
              >
                Back to original
              </button>
            )}
            {editable && isDirty && onSave && (
              <button
                type="button"
                className="admin-btn admin-btn-primary admin-modal-save-btn"
                onClick={() => {
                  void onSave();
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            )}
            <button
              type="button"
              className="admin-btn"
              onClick={() => setFindTriggered(true)}
              disabled={searchableMembers.length === 0}
            >
              Find
            </button>
            <button type="button" className="admin-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="admin-modal-body-grid">
          <div className="admin-modal-stack admin-modal-form-col">
            <div className="admin-modal-row admin-modal-row-id">
              <div className="admin-modal-field admin-modal-field-id">
                <span>ID</span>
                <input className="admin-input" readOnly value={draft.memberNumber || ""} />
              </div>
              <div className="admin-modal-field">
                <span>New member dt</span>
                <input
                  className="admin-input"
                  readOnly
                  value={draft.createdAt ? new Date(draft.createdAt).toLocaleDateString() : ""}
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </div>

            <div className="admin-modal-row admin-modal-row-2">
              <div className="admin-modal-field">
                <span>F_name_1</span>
                <input
                  className="admin-input"
                  value={draft.firstName || ""}
                  onChange={(e) => patch({ firstName: e.target.value })}
                  disabled={!editable}
                />
              </div>
              <div className="admin-modal-field">
                <span>L_name_1</span>
                <input
                  className="admin-input"
                  value={draft.lastName || ""}
                  onChange={(e) => patch({ lastName: e.target.value })}
                  disabled={!editable}
                />
              </div>
            </div>

            <div className="admin-modal-row admin-modal-row-co">
              <div className="admin-modal-field">
                <span>Oil_co</span>
                <input
                  className="admin-input"
                  value={draft.oilCoCode || ""}
                  onChange={(e) => patch({ oilCoCode: e.target.value })}
                  disabled={!editable}
                />
              </div>
              <div className="admin-modal-field">
                <span>Oil co name</span>
                <input
                  className="admin-input"
                  value={draft.oilCompanyName || ""}
                  onChange={(e) => patch({ oilCompanyName: e.target.value })}
                  disabled={!editable}
                />
              </div>
            </div>

            <div className="admin-modal-field">
              <span>Oil_id</span>
              <input
                className="admin-input"
                value={draft.oilId || ""}
                onChange={(e) => patch({ oilId: e.target.value })}
                disabled={!editable}
              />
            </div>

            <div className="admin-modal-radio-grid admin-modal-radio-grid-3">
              {OIL_STATUS.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="dh-oil-st"
                    disabled={!editable}
                    checked={(draft.oilStatus || "UNKNOWN") === s}
                    onChange={() => patch({ oilStatus: s })}
                  />
                  {s}
                </label>
              ))}
            </div>

            <div className="admin-modal-row admin-modal-row-co">
              <div className="admin-modal-field">
                <span>Prop co code</span>
                <input
                  className="admin-input"
                  value={draft.propCoCode || ""}
                  onChange={(e) => patch({ propCoCode: e.target.value })}
                  disabled={!editable}
                />
              </div>
              <div className="admin-modal-field">
                <span>Prop co name</span>
                <input
                  className="admin-input"
                  value={draft.propaneCompanyName || ""}
                  onChange={(e) => patch({ propaneCompanyName: e.target.value })}
                  disabled={!editable}
                />
              </div>
            </div>

            <div className="admin-modal-field">
              <span>Propane id</span>
              <input
                className="admin-input"
                value={draft.propaneId || ""}
                onChange={(e) => patch({ propaneId: e.target.value })}
                disabled={!editable}
              />
            </div>

            <div className="admin-modal-radio-grid admin-modal-radio-grid-3">
              {PROP_STATUS.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="dh-prop-st"
                    disabled={!editable}
                    checked={(draft.propaneStatus || "UNKNOWN") === s}
                    onChange={() => patch({ propaneStatus: s })}
                  />
                  {s}
                </label>
              ))}
            </div>

            <div className="admin-modal-checkbox-stack">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(draft.deliveryHistory)}
                  onChange={(e) => patch({ deliveryHistory: e.target.checked })}
                  disabled={!editable}
                />
                Delivery history
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(draft.delinquent)}
                  onChange={(e) => patch({ delinquent: e.target.checked })}
                  disabled={!editable}
                />
                Delinquent
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(draft.notPaidCurrentYr)}
                  onChange={(e) => patch({ notPaidCurrentYr: e.target.checked })}
                  disabled={!editable}
                />
                Not paid current yr
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(draft.noRecentDels)}
                  onChange={(e) => patch({ noRecentDels: e.target.checked })}
                  disabled={!editable}
                />
                No recent dels
              </label>
            </div>

            <p className="admin-modal-hint">Ctrl/Delete = delete selected delivery</p>
          </div>

          <div className="admin-modal-stack admin-modal-deliveries-col">
            {rowsEditable && (
              <div className="admin-modal-deliveries-toolbar">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={beginAdd}
                  disabled={adding || rowBusy}
                >
                  + Add delivery
                </button>
                {rowError && <span className="admin-modal-row-error">{rowError}</span>}
              </div>
            )}
            <div className="admin-table-wrap admin-modal-deliveries-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Year</th>
                    <th>Type</th>
                    <th>Gallons</th>
                    {rowsEditable && <th aria-label="Actions" style={{ width: "1%", whiteSpace: "nowrap" }} />}
                  </tr>
                </thead>
                <tbody>
                  {adding && rowsEditable && (
                    <DeliveryEditorRow
                      draft={rowDraft}
                      setDraft={setRowDraft}
                      monthNames={monthNames}
                      onSave={handleSaveRow}
                      onCancel={cancelRowEdit}
                      busy={rowBusy}
                    />
                  )}
                  {displayedDeliveries.length === 0 && !adding ? (
                    <tr>
                      <td colSpan={rowsEditable ? 5 : 4} className="admin-modal-table-empty">
                        No deliveries loaded yet.
                      </td>
                    </tr>
                  ) : (
                    displayedDeliveries.map((row, idx) => {
                      const isEditing = rowsEditable && row._id != null && editingRowId === row._id;
                      if (isEditing) {
                        return (
                          <DeliveryEditorRow
                            key={row._id}
                            draft={rowDraft}
                            setDraft={setRowDraft}
                            monthNames={monthNames}
                            onSave={handleSaveRow}
                            onCancel={cancelRowEdit}
                            busy={rowBusy}
                          />
                        );
                      }
                      const monthIdx = Number(row.dateDelivered.slice(5, 7)) - 1;
                      const monthLabel = monthIdx >= 0 && monthIdx < 12 ? monthNames[monthIdx] : formatDeliveryDate(row.dateDelivered);
                      const year = row.dateDelivered.slice(0, 4);
                      return (
                        <tr key={row._id || `${row.dateDelivered}-${row.deliveryYear}-${idx}`}>
                          <td>{monthLabel}</td>
                          <td>{year}</td>
                          <td>{row.fuelType}</td>
                          <td>{row.gallons.toFixed(1)}</td>
                          {rowsEditable && (
                            <td>
                              <div className="admin-modal-row-actions">
                                {onUpdateDelivery && row._id && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-ghost"
                                    onClick={() => beginEdit(row)}
                                    disabled={rowBusy || adding || editingRowId !== null}
                                  >
                                    Edit
                                  </button>
                                )}
                                {onDeleteDelivery && row._id && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-ghost admin-btn-danger"
                                    onClick={() => handleDeleteRow(row)}
                                    disabled={rowBusy || adding || editingRowId !== null}
                                  >
                                    DEL
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-modal-find-row">
              <div className="admin-modal-field">
                <span>Year</span>
                <input
                  className="admin-input"
                  value={findYear}
                  onChange={(e) => setFindYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  placeholder="YYYY"
                  inputMode="numeric"
                />
              </div>
              <div className="admin-modal-field">
                <span>Month</span>
                <select className="admin-input" value={findMonth} onChange={(e) => setFindMonth(e.target.value)}>
                  <option value="">Any</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div className="admin-modal-field">
                <span>Day</span>
                <input
                  className="admin-input"
                  value={findDay}
                  onChange={(e) => setFindDay(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                  placeholder="DD"
                  inputMode="numeric"
                />
              </div>
              <div className="admin-modal-field">
                <span>Fuel</span>
                <select
                  className="admin-input"
                  value={findFuel}
                  onChange={(e) => setFindFuel(e.target.value as "" | "OIL" | "PROPANE")}
                >
                  <option value="">Any</option>
                  <option value="OIL">Oil</option>
                  <option value="PROPANE">Propane</option>
                </select>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-primary admin-modal-find-btn"
                onClick={() => setFindTriggered(true)}
                disabled={searchableMembers.length === 0}
              >
                Find
              </button>
              {findTriggered && (
                <button
                  type="button"
                  className="admin-btn admin-modal-find-btn"
                  onClick={() => {
                    setFindTriggered(false);
                    setFindDay("");
                    setFindFuel("");
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            {findTriggered && (
              <div className="admin-table-wrap admin-modal-find-results">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member #</th>
                      <th>Name</th>
                      <th>Deliveries</th>
                      <th>Total gallons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="admin-modal-table-empty">
                          No customers found for that delivery month.
                        </td>
                      </tr>
                    ) : (
                      findResults.map((row) => {
                        const isActive = row.id === selectedFindMemberId;
                        return (
                          <tr
                            key={row.id}
                            className={`admin-modal-find-result-row${isActive ? " is-active" : ""}`}
                            onClick={() => setSelectedFindMemberId(row.id)}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedFindMemberId(row.id);
                              }
                            }}
                            title="Open this customer in the modal"
                          >
                            <td>{row.memberNumber || "—"}</td>
                            <td>{row.name}</td>
                            <td>{row.deliveries}</td>
                            <td>{row.gallons.toFixed(1)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {searchableMembers.length === 0 && (
              <p className="admin-modal-hint">Customer-wide find is available from the Workbench delivery modal.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

type DeliveryEditorRowProps = {
  draft: { year: string; month: string; day: string; fuelType: "OIL" | "PROPANE"; gallons: string };
  setDraft: (next: DeliveryEditorRowProps["draft"]) => void;
  monthNames: string[];
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
};

function DeliveryEditorRow({ draft, setDraft, monthNames, onSave, onCancel, busy }: DeliveryEditorRowProps) {
  const update = (next: Partial<DeliveryEditorRowProps["draft"]>) => setDraft({ ...draft, ...next });
  return (
    <tr className="admin-modal-row-editing">
      <td>
        <select
          className="admin-input admin-modal-row-input"
          value={draft.month}
          onChange={(e) => update({ month: e.target.value })}
          disabled={busy}
        >
          {monthNames.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="admin-input admin-modal-row-input"
          value={draft.year}
          onChange={(e) => update({ year: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
          placeholder="YYYY"
          inputMode="numeric"
          disabled={busy}
        />
      </td>
      <td>
        <select
          className="admin-input admin-modal-row-input"
          value={draft.fuelType}
          onChange={(e) => update({ fuelType: e.target.value as "OIL" | "PROPANE" })}
          disabled={busy}
        >
          <option value="OIL">OIL</option>
          <option value="PROPANE">PROPANE</option>
        </select>
      </td>
      <td>
        <input
          className="admin-input admin-modal-row-input"
          value={draft.gallons}
          onChange={(e) => update({ gallons: e.target.value.replace(/[^\d.]/g, "") })}
          placeholder="0.0"
          inputMode="decimal"
          disabled={busy}
        />
      </td>
      <td>
        <div className="admin-modal-row-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? "…" : "Save"}
          </button>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
