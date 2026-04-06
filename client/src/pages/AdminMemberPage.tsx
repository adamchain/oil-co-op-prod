import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCo = { _id: string; name: string };

export default function AdminMemberPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [oilCos, setOilCos] = useState<OilCo[]>([]);
  const [data, setData] = useState<{
    member: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      memberNumber?: string;
      status: string;
      oilCompanyId?: string | { _id: string; name: string } | null;
      notes?: string;
      nextAnnualBillingDate?: string;
      successfulReferralCount?: number;
      referralWaiveCredits?: number;
      lifetimeAnnualFeeWaived?: boolean;
    };
    billing: Array<{ _id: string; kind: string; status: string; amountCents: number; createdAt: string }>;
    activity: Array<{ action: string; createdAt: string }>;
  } | null>(null);
  const [oilId, setOilId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    api<{ oilCompanies: OilCo[] }>("/api/admin/oil-companies", { token }).then((r) => setOilCos(r.oilCompanies));
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    api<NonNullable<typeof data>>(`/api/admin/members/${id}`, { token }).then((d) => {
      setData(d);
      const oc = d.member.oilCompanyId;
      setOilId(typeof oc === "object" && oc ? oc._id : typeof oc === "string" ? oc : "");
      setNotes(d.member.notes || "");
      setStatus(d.member.status);
    });
  }, [token, id]);

  async function save() {
    if (!token || !id) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/members/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          oilCompanyId: oilId || null,
          notes,
          status,
        }),
      });
      setMsg("Saved.");
      const d = await api<NonNullable<typeof data>>(`/api/admin/members/${id}`, { token });
      setData(d);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <p style={{ color: "var(--admin-muted)" }}>Loading…</p>;
  }

  const m = data.member;

  return (
    <>
      <p style={{ margin: "0 0 1rem" }}>
        <Link to="/admin/members" style={{ color: "var(--admin-accent)", fontWeight: 500, textDecoration: "none" }}>
          ← Members
        </Link>
      </p>
      <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.35rem", fontWeight: 600 }}>
        {m.firstName} {m.lastName}
      </h1>
      <p style={{ color: "var(--admin-muted)", margin: "0 0 1.5rem", fontSize: "0.875rem" }}>
        {m.email} · {m.memberNumber} · Next June bill:{" "}
        {m.nextAnnualBillingDate ? new Date(m.nextAnnualBillingDate).toLocaleDateString() : "—"}
      </p>

      <div className="admin-card">
        <h2>Oil company assignment</h2>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.8125rem", marginTop: 0 }}>
          Same workflow as the mock admin &quot;Oil Company Status&quot; block — staff picks the participating company
          after signup.
        </p>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.35rem" }}>
            Oil company
          </label>
          <select className="admin-input" value={oilId} onChange={(e) => setOilId(e.target.value)} style={{ width: "100%", maxWidth: "360px" }}>
            <option value="">— Not assigned —</option>
            {oilCos.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.35rem" }}>
            Status
          </label>
          <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", maxWidth: "240px" }}>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", color: "var(--admin-muted)", marginBottom: "0.35rem" }}>
            Internal notes
          </label>
          <textarea
            className="admin-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ width: "100%", maxWidth: "480px", resize: "vertical" }}
          />
        </div>
        {msg && <p style={{ color: msg === "Saved." ? "var(--admin-text)" : "#b91c1c", fontSize: "0.875rem" }}>{msg}</p>}
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => void save()} disabled={saving}>
          Save
        </button>
      </div>

      <div className="admin-card">
        <h2>Referrals & waivers</h2>
        <p style={{ margin: 0, fontSize: "0.875rem" }}>
          Successful referrals: <strong>{m.successfulReferralCount ?? 0}</strong> · Credits:{" "}
          <strong>{m.referralWaiveCredits ?? 0}</strong> · Lifetime annual waived:{" "}
          <strong>{m.lifetimeAnnualFeeWaived ? "Yes" : "No"}</strong>
        </p>
      </div>

      <div className="admin-card">
        <h2>Billing history</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.billing.map((b) => (
                <tr key={b._id}>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                  <td>{b.kind}</td>
                  <td>{b.status}</td>
                  <td>${(b.amountCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h2>Activity log</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--admin-muted)", fontSize: "0.8125rem" }}>
          {data.activity.slice(0, 20).map((a, i) => (
            <li key={i} style={{ marginBottom: "0.35rem" }}>
              {a.action} · {new Date(a.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
