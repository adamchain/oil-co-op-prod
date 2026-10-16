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
  renewalHoldReason?: string;
  renewalHoldSince?: string | null;
  authnetPaymentProfileId?: string;
};

type RenewalOutcome =
  | "charged"
  | "simulated_charge"
  | "would_charge"
  | "waived_lifetime"
  | "waived_additional_property"
  | "waived_referral_credit"
  | "hold_no_payment_method"
  | "hold_check"
  | "hold_auto_renew_off"
  | "hold_card_expired"
  | "hold_card_declined";

type RenewalReport = {
  dueDate: string;
  dryRun: boolean;
  total: number;
  counts: Partial<Record<RenewalOutcome, number>>;
  rows: Array<{
    memberId: string;
    memberNumber: string;
    name: string;
    plan: string;
    amountCents: number;
    outcome: RenewalOutcome;
    detail: string;
  }>;
};

const OUTCOME_LABELS: Record<RenewalOutcome, string> = {
  charged: "Charged",
  simulated_charge: "Charged (simulated — no processor)",
  would_charge: "Will charge card",
  waived_lifetime: "Free — lifetime",
  waived_additional_property: "Free — additional property",
  waived_referral_credit: "Free — referral credit",
  hold_no_payment_method: "On hold — no payment method",
  hold_check: "On hold — awaiting check",
  hold_auto_renew_off: "On hold — auto-renew off",
  hold_card_expired: "On hold — card expired",
  hold_card_declined: "On hold — card declined",
};

const HOLD_REASON_LABELS: Record<string, string> = {
  no_payment_method: "No payment method",
  check: "Awaiting check",
  auto_renew_off: "Auto-renew off",
  card_expired: "Card expired",
  card_declined: "Card declined",
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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
  mockRenewalEnabled?: boolean;
  mockRenewalAuthnetOnly?: boolean;
};

type MockResult = {
  amountCents: number;
  billingYear: number;
  nextAnnualBillingDate: string;
  memberNumber: string;
};

export default function AdminRenewalsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberNumberQ, setMemberNumberQ] = useState("");
  const [nameQ, setNameQ] = useState("");
  const [emailQ, setEmailQ] = useState("");

  function load() {
    if (!token) return;
    api<Dashboard>("/api/admin/renewals/dashboard", { token }).then(setData);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function mockRenew(m: MemberRow) {
    if (!token) return;
    const ok = window.confirm(
      `Record a mock renewal for ${m.firstName} ${m.lastName} (${m.memberNumber || "no member #"})?\n\nThis marks the annual fee paid without charging a card and moves the next renewal to the following June 1.`
    );
    if (!ok) return;
    setBusyId(m._id);
    setNotice(null);
    setError(null);
    try {
      const res = await api<MockResult>(`/api/admin/renewals/mock/${m._id}`, { method: "POST", token });
      const next = new Date(res.nextAnnualBillingDate);
      const nextLabel = Number.isNaN(next.getTime())
        ? res.nextAnnualBillingDate
        : next.toLocaleDateString(undefined, { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
      setNotice(
        `Mock renewal recorded for ${res.memberNumber || m.memberNumber || "member"}: $${(res.amountCents / 100).toFixed(2)} for ${res.billingYear}. Next renewal ${nextLabel}.`
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mock renewal failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <p style={{ color: "var(--admin-muted)" }}>Loading…</p>;

  const searching = Boolean(memberNumberQ.trim() || nameQ.trim() || emailQ.trim());

  function matchesMember(m: MemberRow) {
    const num = memberNumberQ.trim().toLowerCase();
    const nm = nameQ.trim().toLowerCase();
    const em = emailQ.trim().toLowerCase();
    if (num && !(m.memberNumber || "").toLowerCase().includes(num)) return false;
    if (nm && !`${m.firstName} ${m.lastName}`.toLowerCase().includes(nm)) return false;
    if (em && !(m.email || "").toLowerCase().includes(em)) return false;
    return true;
  }

  const onHold = (data.filters.onHold || []).filter(matchesMember);
  const autoRows = [...data.lanes.autoRenewLane]
    .filter(matchesMember)
    .sort((a, b) => Number(Boolean(b.authnetPaymentProfileId)) - Number(Boolean(a.authnetPaymentProfileId)));
  const manualRows = data.lanes.manualRenewalLane.filter(matchesMember);

  return (
    <>
      <RenewalRunCard token={token} onRan={() => token && api<Dashboard>("/api/admin/renewals/dashboard", { token }).then(setData)} />

      <div className="admin-card">
        <h2>On hold ({onHold.length})</h2>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
          Renewals that couldn't be collected. Record the payment (or waive it) on the member's payment history with
          Type "Renew" to take them off hold.
        </p>
        {onHold.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member #</th>
                  <th>Name</th>
                  <th>Reason</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {onHold.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <a href={`/admin/workbench?member=${m._id}`}>{m.memberNumber || "—"}</a>
                    </td>
                    <td>
                      {m.firstName} {m.lastName}
                    </td>
                    <td>{HOLD_REASON_LABELS[m.renewalHoldReason || ""] || m.renewalHoldReason || "—"}</td>
                    <td>{m.renewalHoldSince ? new Date(m.renewalHoldSince).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "var(--admin-muted)", margin: 0 }}>
            {searching ? "No one on hold matches." : "Nobody is on hold."}
          </p>
        )}
      </div>

      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Renewals Dashboard from the ops plan: auto-renew lane, manual lane, and key renewal filters.
      </p>
      {data.mockRenewalEnabled && (
        <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
          Temporary test: Mock renew records a simulated annual charge and does not contact Authorize.Net. With sandbox keys on, the button is only on members who have a vaulted card. It turns off if Authorize.Net is switched to production.
        </p>
      )}
      {notice && (
        <p style={{ color: "var(--admin-text)", fontSize: "0.875rem", margin: "0 0 1rem" }}>{notice}</p>
      )}
      {error && (
        <p style={{ color: "#b91c1c", fontSize: "0.875rem", margin: "0 0 1rem" }}>{error}</p>
      )}

      <div className="admin-card">
        <h2>Find a member</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}>
            Member #
            <input
              type="search"
              className="admin-input"
              value={memberNumberQ}
              onChange={(e) => setMemberNumberQ(e.target.value)}
              placeholder="CT-16615"
              style={{ minWidth: "140px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}>
            Name
            <input
              type="search"
              className="admin-input"
              value={nameQ}
              onChange={(e) => setNameQ(e.target.value)}
              placeholder="First or last name"
              style={{ minWidth: "180px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}>
            Email
            <input
              type="search"
              className="admin-input"
              value={emailQ}
              onChange={(e) => setEmailQ(e.target.value)}
              placeholder="name@email.com"
              style={{ minWidth: "200px" }}
            />
          </label>
          {searching && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setMemberNumberQ("");
                setNameQ("");
                setEmailQ("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

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
        <h2>Auto-Renew Lane{searching ? ` (${autoRows.length})` : ""}</h2>
        {searching && autoRows.length > 80 && (
          <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            Showing the first 80 matches. Narrow the search to see the rest.
          </p>
        )}
        <MemberTable
          rows={searching ? autoRows.slice(0, 80) : autoRows.slice(0, 40)}
          onMockRenew={data.mockRenewalEnabled ? mockRenew : undefined}
          mockAuthnetOnly={Boolean(data.mockRenewalAuthnetOnly)}
          busyId={busyId}
          emptyLabel={searching ? "No auto-renew members match." : undefined}
        />
      </div>

      <div className="admin-card">
        <h2>Manual Renewal Lane{searching ? ` (${manualRows.length})` : ""}</h2>
        {searching && manualRows.length > 80 && (
          <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            Showing the first 80 matches. Narrow the search to see the rest.
          </p>
        )}
        <MemberTable
          rows={searching ? manualRows.slice(0, 80) : manualRows.slice(0, 60)}
          emptyLabel={searching ? "No manual-renewal members match." : undefined}
        />
      </div>
    </>
  );
}

function MemberTable({
  rows,
  onMockRenew,
  mockAuthnetOnly,
  busyId,
  emptyLabel,
}: {
  rows: MemberRow[];
  onMockRenew?: (m: MemberRow) => void;
  mockAuthnetOnly?: boolean;
  busyId?: string | null;
  emptyLabel?: string;
}) {
  function showMock(m: MemberRow) {
    if (!onMockRenew) return false;
    if (mockAuthnetOnly) return Boolean(m.authnetPaymentProfileId);
    return true;
  }
  const anyMock = rows.some(showMock);
  if (!rows.length && emptyLabel) {
    return <p style={{ color: "var(--admin-muted)", margin: 0 }}>{emptyLabel}</p>;
  }
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
            {anyMock && <th></th>}
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
              {anyMock && (
                <td>
                  {showMock(m) && onMockRenew && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-xs"
                      disabled={busyId === m._id}
                      onClick={() => onMockRenew(m)}
                    >
                      {busyId === m._id ? "Working…" : "Mock renew"}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Mock / manual renewal: preview what a renewal on a given date would do to every member
 * due that day, then run it. For a test, set a handful of members' next renewal to the
 * test date (e.g. 9/17), preview, and run.
 */
function RenewalRunCard({ token, onRan }: { token: string | null; onRan: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<RenewalReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(kind: "preview" | "run") {
    if (!token) return;
    if (kind === "run") {
      const ok = window.confirm(
        `Run the renewal for everyone due on ${date}?\n\nCards on file will be charged and members who can't be charged go on hold. This cannot be undone.`
      );
      if (!ok) return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await api<RenewalReport>(`/api/admin/renewals/${kind}`, {
        method: "POST",
        token,
        body: JSON.stringify({ date }),
      });
      setReport(r);
      if (kind === "run") onRan();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Renewal request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>Run a renewal</h2>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.6rem" }}>
        Renewals run automatically every June 1. To test, set a few members' next renewal date to a test day, preview
        it here, then run it.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label>
          Renewal date{" "}
          <input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="admin-wb-btn admin-wb-btn-secondary" disabled={busy || !date} onClick={() => void go("preview")}>
          Preview
        </button>
        <button type="button" className="admin-wb-btn admin-wb-btn-primary" disabled={busy || !date} onClick={() => void go("run")}>
          Run renewal
        </button>
      </div>
      {err && <p style={{ color: "var(--admin-danger, #b42318)" }}>{err}</p>}
      {report && (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ margin: "0 0 0.4rem" }}>
            <strong>{report.dryRun ? "Preview" : "Ran"}</strong> for{" "}
            {new Date(report.dueDate).toLocaleDateString(undefined, { timeZone: "UTC" })}: {report.total} member
            {report.total === 1 ? "" : "s"} due.{" "}
            {Object.entries(report.counts)
              .map(([k, n]) => `${OUTCOME_LABELS[k as RenewalOutcome] || k}: ${n}`)
              .join(" · ")}
          </p>
          {report.rows.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Member #</th>
                    <th>Name</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Result</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.memberId}>
                      <td>
                        <a href={`/admin/workbench?member=${r.memberId}`}>{r.memberNumber || "—"}</a>
                      </td>
                      <td>{r.name}</td>
                      <td>{r.plan}</td>
                      <td>{usd(r.amountCents)}</td>
                      <td>{OUTCOME_LABELS[r.outcome] || r.outcome}</td>
                      <td>{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
