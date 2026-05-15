import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../authContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `admin-sidebar-link${isActive ? " active" : ""}`;

export default function AdminLayout() {
  const { member, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <NavLink to="/admin/oil-companies" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Companies
          </NavLink>
          <NavLink to="/admin/members" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Members
          </NavLink>
          <NavLink to="/admin/deliveries/search" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Deliveries
          </NavLink>
          <NavLink to="/admin/deliveries/import" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Import deliveries
          </NavLink>
          <NavLink to="/admin/communications" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Communications
          </NavLink>
          <NavLink to="/admin/email-templates" className={linkClass} onClick={() => setSidebarOpen(false)}>
            Email Templates
          </NavLink>
        </nav>
        <div className="admin-sidebar-bottom">
          <NavLink
            to="/admin/add-customer"
            className={linkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Add Customer
          </NavLink>
        </div>
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
