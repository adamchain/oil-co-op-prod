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
  authnetCardLast4?: string;
  authnetCardExpiry?: string;
  amountCents?: number;
  lifetime?: boolean;
  paidCurrent?: boolean;
  paymentFailed?: boolean;
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

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type LaneTab = "auto" | "manual" | "failed" | "onHold";

type Dashboard = {
  summary: {
    totalMembers: number;
    activeMembers: number;
    lifetimeCount: number;
    autoRenewLaneCount: number;
    manualRenewalLaneCount: number;
    successfullyProcessedCount: number;
    paymentFailedCount: number;
    onHoldCount: number;
    currentBillingYear: number;
    nextRenewalYear: number;
  };
  lanes: {
    autoRenewLane: MemberRow[];
    manualRenewalLane: MemberRow[];
    successfullyProcessed: MemberRow[];
    paymentFailed: MemberRow[];
    onHold: MemberRow[];
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
  const [tab, setTab] = useState<LaneTab>("auto");

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

  const failed = (data.lanes.paymentFailed || []).filter(matchesMember);
  const onHold = (data.lanes.onHold || data.filters.onHold || []).filter(matchesMember);
  const autoRows = [...data.lanes.autoRenewLane]
    .filter(matchesMember)
    .sort((a, b) => Number(Boolean(b.authnetPaymentProfileId)) - Number(Boolean(a.authnetPaymentProfileId)));
  const manualRows = data.lanes.manualRenewalLane.filter(matchesMember);
  const year = data.summary.currentBillingYear;
  const nextYear = data.summary.nextRenewalYear;

  return (
    <>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
        Active members have an oil or propane account in service, or a membership paid for {year - 1} or {year}.
        Lifetime members are included and are not charged. Auto-renew is who has a card on file for June 1, {nextYear}.
        Manual is everyone else. After June 1, {year}, a failed card is “payment failed” and an unpaid manual member is on hold.
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
        <div className="admin-stat tone-green">
          <strong>{data.summary.activeMembers}</strong>
          <span>Active members</span>
        </div>
        <div className="admin-stat tone-blue">
          <strong>{data.summary.autoRenewLaneCount}</strong>
          <span>Auto-renew · June 1, {nextYear}</span>
        </div>
        <div className="admin-stat tone-yellow">
          <strong>{data.summary.manualRenewalLaneCount}</strong>
          <span>Manual lane · June 1, {nextYear}</span>
        </div>
        <div className="admin-stat">
          <strong>{data.summary.lifetimeCount}</strong>
          <span>Lifetime · not charged</span>
        </div>
      </div>

      <h2 style={{ fontSize: "1rem", margin: "0.25rem 0 0.6rem" }}>Since June 1, {year}</h2>
      <div className="admin-stats">
        <div className="admin-stat tone-green">
          <strong>{data.summary.successfullyProcessedCount}</strong>
          <span>Successfully processed</span>
        </div>
        <div className="admin-stat tone-red">
          <strong>{data.summary.paymentFailedCount}</strong>
          <span>Payment failed</span>
        </div>
        <div className="admin-stat tone-yellow">
          <strong>{data.summary.onHoldCount}</strong>
          <span>On hold · manual past due</span>
        </div>
        <div className="admin-stat">
          <strong>{data.filters.renewingNext7Days?.length || 0}</strong>
          <span>Due next 7 days</span>
        </div>
      </div>

      <div className="admin-lane-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "auto"}
          className={`admin-lane-tab${tab === "auto" ? " active" : ""}`}
          onClick={() => setTab("auto")}
        >
          Auto-Renew Lane <span>{autoRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "manual"}
          className={`admin-lane-tab${tab === "manual" ? " active" : ""}`}
          onClick={() => setTab("manual")}
        >
          Manual Lane <span>{manualRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "failed"}
          className={`admin-lane-tab${tab === "failed" ? " active" : ""}`}
          onClick={() => setTab("failed")}
        >
          Payment failed <span>{failed.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "onHold"}
          className={`admin-lane-tab${tab === "onHold" ? " active" : ""}`}
          onClick={() => setTab("onHold")}
        >
          On hold <span>{onHold.length}</span>
        </button>
      </div>

      {tab === "failed" && (
        <div className="admin-card">
          <h2>Payment failed ({failed.length})</h2>
          <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            Auto-renew members whose {year} membership did not go through. They still need to update the card or pay.
          </p>
          {!searching && failed.length > 40 && (
            <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
              Showing the first 40. Search to narrow the list.
            </p>
          )}
          <MemberTable
            rows={searching ? failed.slice(0, 80) : failed.slice(0, 40)}
            showCard
            emptyLabel={failed.length ? undefined : searching ? "No payment failures match." : "No failed payments for this renewal."}
          />
        </div>
      )}

      {tab === "onHold" && (
        <div className="admin-card">
          <h2>On hold ({onHold.length})</h2>
          <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            Manual-lane members with no {year} payment. Record the payment on their history (type Renew) and they move to successfully processed.
          </p>
          {!searching && onHold.length > 40 && (
            <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
              Showing the first 40. Search to narrow the list.
            </p>
          )}
          <MemberTable
            rows={searching ? onHold.slice(0, 80) : onHold.slice(0, 40)}
            emptyLabel={onHold.length ? undefined : searching ? "No one on hold matches." : "Nobody in the manual lane is past due."}
          />
        </div>
      )}

      {tab === "auto" && (
        <div className="admin-card">
          <h2>Auto-Renew Lane{searching ? ` (${autoRows.length})` : ""}</h2>
          <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            Card on file for the June 1, {nextYear} renewal. Amount is $35 standard, $25 senior, or $20 low volume.
          </p>
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
            showCard
            showAmount
            emptyLabel={searching ? "No auto-renew members match." : undefined}
          />
        </div>
      )}

      {tab === "manual" && (
        <div className="admin-card">
          <h2>Manual Renewal Lane{searching ? ` (${manualRows.length})` : ""}</h2>
          <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            No card on file. They are not charged on June 1; after that date, anyone still unpaid is on hold.
          </p>
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
      )}

      <RenewalRunCard token={token} onRan={() => token && api<Dashboard>("/api/admin/renewals/dashboard", { token }).then(setData)} />
    </>
  );
}

function cardLabel(m: MemberRow): string {
  const last4 = (m.authnetCardLast4 || "").trim();
  const exp = (m.authnetCardExpiry || "").replace(/\D/g, "");
  const expLabel = exp.length === 4 ? `${exp.slice(0, 2)}/${exp.slice(2)}` : "";
  if (!last4 && !expLabel) return "—";
  return [last4 ? `•••• ${last4}` : "", expLabel ? `exp ${expLabel}` : ""].filter(Boolean).join(" · ");
}

function MemberTable({
  rows,
  onMockRenew,
  mockAuthnetOnly,
  busyId,
  emptyLabel,
  showCard,
  showAmount,
}: {
  rows: MemberRow[];
  onMockRenew?: (m: MemberRow) => void;
  mockAuthnetOnly?: boolean;
  busyId?: string | null;
  emptyLabel?: string;
  showCard?: boolean;
  showAmount?: boolean;
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
            {showAmount && <th>Amount</th>}
            {showCard && <th>Card on file</th>}
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
              {showAmount && <td>{usd(m.amountCents || 0)}</td>}
              {showCard && <td>{cardLabel(m)}</td>}
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
        June 1 only renews active oil, propane, and membership accounts. To test one person, set their next renewal to
        another date, preview it here, then run it.
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
