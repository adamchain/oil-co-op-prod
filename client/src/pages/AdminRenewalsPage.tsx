import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type MemberRow = {
  _id: string;
  memberNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  paymentMethod: string;
  autoRenew: boolean;
  daysUntilDue: number | null;
};

type Dashboard = {
  summary: {
    totalMembers: number;
    activeMembers: number;
    autoRenewLaneCount: number;
    manualRenewalLaneCount: number;
  };
  lanes: {
    autoRenewLane: MemberRow[];
    manualRenewalLane: MemberRow[];
  };
  filters: Record<string, MemberRow[]>;
};

export default function AdminRenewalsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Dashboard>("/api/admin/renewals/dashboard", { token }).then(setData);
  }, [token]);

  if (!data) return <p style={{ color: "var(--admin-muted)" }}>Loading…</p>;

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Renewals Dashboard from the ops plan: auto-renew lane, manual lane, and key renewal filters.
      </p>

      <div className="admin-stats">
        <div className="admin-stat">
          <strong>{data.summary.activeMembers}</strong>
          <span>Active members</span>
        </div>
        <div className="admin-stat">
          <strong>{data.summary.autoRenewLaneCount}</strong>
          <span>Auto-renew lane</span>
        </div>
        <div className="admin-stat">
          <strong>{data.summary.manualRenewalLaneCount}</strong>
          <span>Manual lane</span>
        </div>
        <div className="admin-stat">
          <strong>{data.filters.renewingNext7Days?.length || 0}</strong>
          <span>Due next 7 days</span>
        </div>
      </div>

      <div className="admin-card">
        <h2>Auto-Renew Lane</h2>
        <MemberTable rows={data.lanes.autoRenewLane.slice(0, 40)} />
      </div>

      <div className="admin-card">
        <h2>Manual Renewal Lane</h2>
        <MemberTable rows={data.lanes.manualRenewalLane.slice(0, 60)} />
      </div>
    </>
  );
}

function MemberTable({ rows }: { rows: MemberRow[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Member #</th>
            <th>Name</th>
            <th>Email</th>
            <th>Method</th>
            <th>Auto-renew</th>
            <th>Days to due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m._id}>
              <td>{m.memberNumber || "—"}</td>
              <td>
                {m.firstName} {m.lastName}
              </td>
              <td>{m.email}</td>
              <td>{m.paymentMethod}</td>
              <td>{m.autoRenew ? "Yes" : "No"}</td>
              <td>{m.daysUntilDue ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
