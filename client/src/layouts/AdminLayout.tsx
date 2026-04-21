import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../authContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `admin-sidebar-link${isActive ? " active" : ""}`;

export default function AdminLayout() {
  const { member, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const navigate = useNavigate();

  const runGlobalSearch = () => {
    const q = globalSearch.trim();
    navigate(q ? `/admin/members?q=${encodeURIComponent(q)}` : "/admin/members");
  };

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <Link to="/" className="admin-sidebar-brand" onClick={() => setSidebarOpen(false)}>
          Oil Co-op
          <small>Member management</small>
        </Link>
        <nav className="admin-sidebar-nav">
          <NavLink to="/admin" end className={linkClass} onClick={() => setSidebarOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/members" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Members
          </NavLink>
          <NavLink to="/admin/renewals" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Renewals
          </NavLink>
          <NavLink to="/admin/exceptions" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Tasks
          </NavLink>
          <NavLink to="/admin/communications" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Communications
          </NavLink>
          <NavLink to="/admin/reports" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Reports
          </NavLink>
          <NavLink to="/admin/agents" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Agents
          </NavLink>
          <NavLink to="/admin/workbench" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Data Entry
          </NavLink>
          <NavLink to="/admin/email-templates" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Email Templates
          </NavLink>
        </nav>
        <div className="admin-sidebar-foot">
          <div style={{ marginBottom: "0.5rem" }}>
            {member?.firstName} {member?.lastName}
          </div>
          <Link to="/" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
            View public site
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            style={{
              marginTop: "0.75rem",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
              fontSize: "0.85rem",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              className="admin-sidebar-toggle"
              aria-label="Toggle menu"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <span />
              <span />
              <span />
            </button>
            <h1>Operations</h1>
          </div>
          <div className="admin-topbar-actions">
            <input
              type="search"
              className="admin-input"
              placeholder="Global search members..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runGlobalSearch();
              }}
              style={{ minWidth: "240px" }}
            />
            <button type="button" className="admin-btn" onClick={runGlobalSearch}>
              Search
            </button>
          </div>
        </header>
        <div className="admin-body">
          <Outlet />
        </div>
      </div>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="admin-backdrop"
        />
      )}
    </div>
  );
}
