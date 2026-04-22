import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type MemberRow = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  memberNumber?: string;
  status: string;
  oilCompanyId?: { name?: string } | null;
};

export default function AdminMembersPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [rows, setRows] = useState<MemberRow[]>([]);

  useEffect(() => {
    setQ(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    api<{ members: MemberRow[] }>(`/api/admin/members?${u}`, { token }).then((r) => setRows(r.members));
  }, [token, q]);

  const workbenchHref = (memberId: string) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    p.set("member", memberId);
    return `/admin/workbench?${p.toString()}`;
  };

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Search mirrors the mock admin &quot;global search&quot; pattern. Assign oil company on the member record — data
        is live from your API.
      </p>
      <div className="admin-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
          <input
            type="search"
            className="admin-input"
            placeholder="Search name, email, phone, member #…"
            value={q}
            onChange={(e) => {
              const next = e.target.value;
              setQ(next);
              setSearchParams(next.trim() ? { q: next } : {});
            }}
            style={{ flex: "1", minWidth: "220px" }}
          />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member #</th>
                <th>Name</th>
                <th>Email</th>
                <th>Oil company</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    navigate(workbenchHref(m._id));
                  }}
                >
                  <td>
                    <Link to={workbenchHref(m._id)} onClick={(e) => e.stopPropagation()}>
                      {m.memberNumber || "—"}
                    </Link>
                  </td>
                  <td>
                    {m.firstName} {m.lastName}
                  </td>
                  <td>{m.email}</td>
                  <td>{m.oilCompanyId && typeof m.oilCompanyId === "object" ? m.oilCompanyId.name : "—"}</td>
                  <td>
                    <span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p style={{ color: "var(--admin-muted)", padding: "1rem", margin: 0 }}>No members match.</p>
        )}
      </div>
    </>
  );
}
