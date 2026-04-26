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
  const [draftQ, setDraftQ] = useState(searchParams.get("q") || "");
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const next = searchParams.get("q") || "";
    setQ(next);
    setDraftQ(next);
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    api<{ members: MemberRow[] }>(`/api/admin/members?${u}`, { token }).then((r) => setRows(r.members));
  }, [token, q]);

  useEffect(() => {
    setPage(1);
  }, [q, rows.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

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
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const next = draftQ.trim();
              setSearchParams(next ? { q: next } : {});
            }}
            style={{ flex: "1", minWidth: "220px" }}
          />
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              const next = draftQ.trim();
              setSearchParams(next ? { q: next } : {});
            }}
          >
            Search Records
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setDraftQ("");
              setSearchParams({});
            }}
          >
            Clear
          </button>
        </div>
        <div className="admin-toolbar" style={{ marginBottom: "0.6rem", justifyContent: "space-between" }}>
          <span className="admin-meta">
            {rows.length} member(s) • Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
            <label className="admin-meta" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              Rows
              <select
                className="admin-input"
                style={{ minWidth: "72px", padding: "0.28rem 0.45rem" }}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPage(1)} disabled={page <= 1}>First</button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>Last</button>
          </div>
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
              {pageRows.map((m) => (
                <tr
                  key={m._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    navigate(workbenchHref(m._id));
                  }}
                >
                  <td>
                    <Link to={workbenchHref(m._id)} onClick={(e) => e.stopPropagation()}>
                      <span style={{ fontWeight: 600 }}>{m.memberNumber || "—"}</span>
                    </Link>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{m.firstName} {m.lastName}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{m.email}</td>
                  <td style={{ fontWeight: 600 }}>{m.oilCompanyId && typeof m.oilCompanyId === "object" ? m.oilCompanyId.name : "—"}</td>
                  <td>
                    <span className={`admin-pill${m.status === "active" ? " ok" : ""}`}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageRows.length === 0 && (
          <p style={{ color: "var(--admin-muted)", padding: "1rem", margin: 0 }}>No members match.</p>
        )}
      </div>
    </>
  );
}
