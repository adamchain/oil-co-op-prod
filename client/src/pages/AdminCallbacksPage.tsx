import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type CallbackMember = {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  legacyProfile?: Record<string, unknown>;
};

function formatDate(raw: unknown): string {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString();
}

function callbackTimestamp(raw: unknown): number {
  const s = String(raw || "").trim();
  if (!s) return Number.POSITIVE_INFINITY;
  const t = Date.parse(s);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export default function AdminCallbacksPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<CallbackMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const { members: rows } = await api<{ members: CallbackMember[] }>("/api/admin/members?all=1", { token });
      setMembers(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const callbackRows = useMemo(() => {
    return members
      .filter((m) => {
        const lp = (m.legacyProfile || {}) as Record<string, unknown>;
        return lp.callBack === true;
      })
      .sort((a, b) => {
        const aLp = (a.legacyProfile || {}) as Record<string, unknown>;
        const bLp = (b.legacyProfile || {}) as Record<string, unknown>;
        return callbackTimestamp(aLp.callBackDate) - callbackTimestamp(bLp.callBackDate);
      });
  }, [members]);

  async function removeFromCallbacks(memberId: string) {
    if (!token) return;
    setRemovingId(memberId);
    try {
      await api(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ legacyProfile: { callBack: false } }),
      });
      setMembers((prev) =>
        prev.map((m) =>
          m._id === memberId
            ? {
                ...m,
                legacyProfile: {
                  ...(m.legacyProfile || {}),
                  callBack: false,
                },
              }
            : m
        )
      );
    } finally {
      setRemovingId(null);
    }
  }

  function goToWorkbench(memberId: string) {
    navigate(`/admin/workbench?member=${encodeURIComponent(memberId)}`);
  }

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Members flagged for a call back in the workbench. Click a row to open the member in the workbench, or
        remove from the list (this un-checks the &quot;Call Back&quot; box but keeps the date and notes on the member record).
      </p>
      <div className="admin-card">
        <div className="admin-toolbar" style={{ marginBottom: "0.6rem", justifyContent: "space-between" }}>
          <span className="admin-meta">
            {loading ? "Loading…" : `${callbackRows.length} callback${callbackRows.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Call Back Date</th>
                <th>Notes</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {callbackRows.map((m) => {
                const lp = (m.legacyProfile || {}) as Record<string, unknown>;
                const notes = String(lp.callBackNotes || "").trim();
                return (
                  <tr
                    key={m._id}
                    style={{ cursor: "pointer" }}
                    onClick={() => goToWorkbench(m._id)}
                  >
                    <td style={{ fontWeight: 600 }}>
                      {m.firstName} {m.lastName}
                    </td>
                    <td>{m.phone || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{formatDate(lp.callBackDate)}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{notes || "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost"
                        disabled={removingId === m._id}
                        onClick={() => void removeFromCallbacks(m._id)}
                      >
                        {removingId === m._id ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && callbackRows.length === 0 && (
          <p style={{ color: "var(--admin-muted)", padding: "1rem", margin: 0 }}>
            No members are currently flagged for a call back.
          </p>
        )}
      </div>
    </>
  );
}
