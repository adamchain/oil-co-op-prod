import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type DashboardData = {
  totalMembers: number;
  activeMembers: number;
  openTasks: number;
  activeJobs: number;
  activeLeads: number;
  outstandingAmount: number;
  renewingNext30Days: number;
  recentSignups: number;
};

const quickAccessItems = [
  {
    title: "Members",
    description: "Manage your member relationships",
    href: "/admin/members",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Tasks",
    description: "Track and complete work items",
    href: "/admin/exceptions",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    title: "Renewals",
    description: "View upcoming billing dates",
    href: "/admin/renewals",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: "Communications",
    description: "Email and notification history",
    href: "/admin/communications",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    title: "Reports",
    description: "Revenue, invoices, and analytics",
    href: "/admin/reports",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: "Agents",
    description: "AI assistant for quick insights",
    href: "/admin/agents",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2" />
        <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2" />
      </svg>
    ),
  },
];

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      try {
        const [membersRes, exceptionsRes] = await Promise.all([
          api<{ members: Array<{ status: string; nextAnnualBillingDate?: string; createdAt?: string }> }>("/api/admin/members?limit=1000", { token }),
          api<{ summary: { totalTasks: number } }>("/api/admin/exceptions", { token }),
        ]);

        const members = membersRes.members;
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        setData({
          totalMembers: members.length,
          activeMembers: members.filter((m) => m.status === "active").length,
          openTasks: exceptionsRes.summary.totalTasks,
          activeJobs: members.filter((m) => m.status === "active").length,
          activeLeads: members.filter((m) => m.status !== "active" && m.status !== "cancelled").length,
          outstandingAmount: 0, // Would come from billing
          renewingNext30Days: members.filter((m) => {
            if (!m.nextAnnualBillingDate) return false;
            const d = new Date(m.nextAnnualBillingDate);
            return d >= now && d <= thirtyDaysFromNow;
          }).length,
          recentSignups: members.filter((m) => {
            if (!m.createdAt) return false;
            return new Date(m.createdAt) >= sevenDaysAgo;
          }).length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  const getStatusColor = (value: number, type: "tasks" | "members" | "amount") => {
    if (type === "tasks") {
      if (value === 0) return { bg: "#ecfdf5", text: "#065f46", label: "Clear" };
      if (value < 5) return { bg: "#fef3c7", text: "#92400e", label: "Active" };
      return { bg: "#fef2f2", text: "#991b1b", label: "Busy" };
    }
    if (type === "amount") {
      return { bg: "#ecfdf5", text: "#065f46", label: "On track" };
    }
    return { bg: "#f0fdf4", text: "#166534", label: "Active" };
  };

  return (
    <div className="admin-minimal">
      {/* Quick Access */}
      <section className="admin-minimal-section">
        <h2 className="admin-minimal-heading">Quick access</h2>
        <div className="admin-minimal-cards">
          {quickAccessItems.map((item) => (
            <Link key={item.href} to={item.href} className="admin-minimal-card">
              <div className="admin-minimal-card-icon">{item.icon}</div>
              <div className="admin-minimal-card-content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Organization Snapshot */}
      <section className="admin-minimal-section">
        <h2 className="admin-minimal-heading">Organization snapshot</h2>
        <div className="admin-minimal-table-wrap">
          <table className="admin-minimal-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "#78716c" }}>
                    Loading...
                  </td>
                </tr>
              ) : data ? (
                <>
                  <tr>
                    <td>Total Members</td>
                    <td className="admin-minimal-table-count">{data.totalMembers}</td>
                    <td>
                      <span className="admin-minimal-status" style={{ background: getStatusColor(data.activeMembers, "members").bg, color: getStatusColor(data.activeMembers, "members").text }}>
                        {data.activeMembers} active
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Open Tasks</td>
                    <td className="admin-minimal-table-count">{data.openTasks}</td>
                    <td>
                      <span className="admin-minimal-status" style={{ background: getStatusColor(data.openTasks, "tasks").bg, color: getStatusColor(data.openTasks, "tasks").text }}>
                        {getStatusColor(data.openTasks, "tasks").label}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Renewals (30 days)</td>
                    <td className="admin-minimal-table-count">{data.renewingNext30Days}</td>
                    <td>
                      <span className="admin-minimal-status" style={{ background: "#f0f9ff", color: "#0369a1" }}>
                        Upcoming
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>New Signups (7 days)</td>
                    <td className="admin-minimal-table-count">{data.recentSignups}</td>
                    <td>
                      <span className="admin-minimal-status" style={{ background: "#faf5ff", color: "#7c3aed" }}>
                        Recent
                      </span>
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "#78716c" }}>
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Advanced Tools Link */}
      <section className="admin-minimal-section">
        <Link to="/admin/workbench" className="admin-minimal-advanced-link">
          Open Data Entry Workbench
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
    </div>
  );
}
