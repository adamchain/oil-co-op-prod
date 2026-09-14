import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";
import { formatUsdFromCents } from "../utils/membershipFees";

type Tab = "dashboard" | "payment" | "membership";

type Me = {
  email: string;
  firstName: string;
  lastName: string;
  memberNumber?: string;
  status?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  nextAnnualBillingDate?: string;
  membershipPlanLabel?: string;
  annualFeeCents?: number;
  cardLast4?: string;
  cardExpiry?: string;
  cardOnFile?: boolean;
  autoRenew?: boolean;
  role?: string;
};

function membershipStatus(status?: string): { text: string; kind: "ok" | "warn" } {
  if (status === "expired") return { text: "Expired", kind: "warn" };
  if (status === "cancelled") return { text: "Cancelled", kind: "warn" };
  return { text: "Active", kind: "ok" };
}

function formatBillingDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatExpiryDisplay(raw?: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length !== 4) return "";
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function formatAddress(m: Me): string {
  return [m.addressLine1, m.addressLine2, [m.city, m.state].filter(Boolean).join(", "), m.postalCode]
    .filter(Boolean)
    .join(", ");
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function greetingName(me: Me): string {
  return me.firstName?.trim() || me.email;
}

export default function AccountPage() {
  const { token, member, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "" });

  useEffect(() => {
    if (!token) return;
    api<Me>("/api/auth/me", { token })
      .then(setMe)
      .catch((e) => setErr(String(e.message)));
  }, [token]);

  function go(next: Tab) {
    setTab(next);
    setErr("");
    setOk("");
  }

  async function saveCard(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const digits = card.number.replace(/\D/g, "");
    const expiryDigits = card.expiry.replace(/\D/g, "");
    if (digits.length < 13) {
      setErr("Enter a valid card number.");
      return;
    }
    if (expiryDigits.length !== 4) {
      setErr("Enter expiration as MM/YY.");
      return;
    }
    if (card.cvv.replace(/\D/g, "").length < 3) {
      setErr("Enter the CVV.");
      return;
    }
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const res = await api<{ cardLast4: string; cardOnFile: boolean }>("/api/me/card", {
        method: "POST",
        token,
        body: JSON.stringify({
          cardNumber: digits,
          expiration: expiryDigits,
          cvv: card.cvv.replace(/\D/g, ""),
        }),
      });
      setMe((m) =>
        m
          ? {
              ...m,
              cardLast4: res.cardLast4,
              cardOnFile: res.cardOnFile,
              autoRenew: true,
              cardExpiry: expiryDigits,
            }
          : m
      );
      setCard({ number: "", expiry: "", cvv: "" });
      setOk(res.cardLast4 ? `Card ending in ${res.cardLast4} is saved for automatic renewal.` : "Card saved.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not save card");
    } finally {
      setSaving(false);
    }
  }

  async function removeCard() {
    if (!token) return;
    if (!window.confirm("Remove the card on file? You will not be charged automatically at renewal.")) return;
    setRemoving(true);
    setErr("");
    setOk("");
    try {
      await api("/api/me/card", { method: "DELETE", token });
      setMe((m) => (m ? { ...m, cardLast4: "", cardOnFile: false, autoRenew: false, cardExpiry: "" } : m));
      setOk("Card removed. Email the office if you want to pay by check.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not remove card");
    } finally {
      setRemoving(false);
    }
  }

  if (!me) {
    return (
      <div className="mkt-profile">
        <div className="mkt-profile-loading">
          {err ? <p className="mkt-error">{err}</p> : <p className="mkt-lead">Loading your membership…</p>}
        </div>
      </div>
    );
  }

  const status = membershipStatus(me.status);
  const hasCard = Boolean(me.cardOnFile && me.cardLast4);
  const displayName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;
  const fee = me.annualFeeCents != null ? formatUsdFromCents(me.annualFeeCents) : "—";
  const exp = formatExpiryDisplay(me.cardExpiry);
  const initials = [me.firstName?.[0], me.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "M";

  return (
    <div className="mkt-profile mkt-portal">
      <div className="mkt-portal-shell">
        <aside className="mkt-portal-nav" aria-label="Member portal">
          <div className="mkt-portal-nav-brand">
            <span className="mkt-profile-avatar mkt-portal-avatar" aria-hidden>
              {initials}
            </span>
            <div>
              <p className="mkt-portal-nav-kicker">Member portal</p>
              <p className="mkt-portal-nav-name">{displayName}</p>
              <p className="mkt-portal-nav-meta">#{me.memberNumber || "—"}</p>
            </div>
          </div>
          <nav className="mkt-portal-tabs">
            <button type="button" className={tab === "dashboard" ? "is-active" : ""} onClick={() => go("dashboard")}>
              Dashboard
            </button>
            <button type="button" className={tab === "payment" ? "is-active" : ""} onClick={() => go("payment")}>
              Payment
            </button>
            <button type="button" className={tab === "membership" ? "is-active" : ""} onClick={() => go("membership")}>
              Membership
            </button>
          </nav>
          <div className="mkt-portal-nav-foot">
            {member?.role === "admin" && (
              <Link to="/admin/members" className="mkt-portal-nav-link">
                Admin console
              </Link>
            )}
            <Link to="/" className="mkt-portal-nav-link">
              Public site
            </Link>
            <button type="button" className="mkt-portal-nav-link" onClick={logout}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="mkt-portal-main">
          {err && <p className="mkt-error">{err}</p>}
          {ok && <p className="mkt-profile-ok">{ok}</p>}

          {tab === "dashboard" && (
            <div className="mkt-portal-panel">
              <header className="mkt-portal-welcome">
                <p className="mkt-profile-eyebrow">Welcome back</p>
                <h1 className="mkt-profile-name">{greetingName(me)}</h1>
                <p className="mkt-profile-meta">
                  Thanks for being a co-op member. Here is a snapshot of your membership and billing.
                </p>
                <span className={`mkt-profile-badge mkt-profile-badge--${status.kind}`}>{status.text} membership</span>
              </header>

              <div className="mkt-portal-tiles">
                <article className="mkt-profile-card mkt-portal-tile">
                  <p className="mkt-portal-tile-label">Next billing date</p>
                  <p className="mkt-portal-tile-value">{formatBillingDate(me.nextAnnualBillingDate)}</p>
                  <p className="mkt-portal-tile-hint">
                    {me.membershipPlanLabel || "Standard membership"} · {fee} / year
                  </p>
                </article>
                <article className="mkt-profile-card mkt-portal-tile">
                  <p className="mkt-portal-tile-label">Card on file</p>
                  <p className="mkt-portal-tile-value">
                    {hasCard ? `•••• ${me.cardLast4}` : "None"}
                  </p>
                  <p className="mkt-portal-tile-hint">
                    {hasCard
                      ? [exp ? `Expires ${exp}` : null, me.autoRenew ? "Auto-renew on" : "Auto-renew off"]
                          .filter(Boolean)
                          .join(" · ")
                      : "Add a card for automatic June renewal."}
                  </p>
                  <button type="button" className="mkt-btn mkt-btn-primary mkt-portal-tile-btn" onClick={() => go("payment")}>
                    {hasCard ? "Update card" : "Add card"}
                  </button>
                </article>
              </div>
            </div>
          )}

          {tab === "payment" && (
            <section className="mkt-profile-card">
              <div className="mkt-profile-card-head">
                <h2>Payment</h2>
                <p>
                  Cards are stored with our processor for June automatic renewal. We never keep the full card
                  number in our database.
                </p>
              </div>
              {hasCard ? (
                <p className="mkt-profile-card-onfile">
                  Active card <strong>•••• {me.cardLast4}</strong>
                  {exp ? ` · Exp ${exp}` : ""}
                  {me.autoRenew ? " · Automatic renewal on" : ""}
                </p>
              ) : (
                <p className="mkt-profile-card-onfile">No card on file for automatic renewal.</p>
              )}
              <form onSubmit={(e) => void saveCard(e)}>
                <div className="mkt-profile-grid">
                  <div className="mkt-field mkt-profile-span-2">
                    <label htmlFor="portal-card-number">{hasCard ? "New card number" : "Card number"}</label>
                    <input
                      id="portal-card-number"
                      className="mkt-input"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="ACCT-000015"
                      value={card.number}
                      onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                    />
                  </div>
                  <div className="mkt-field">
                    <label htmlFor="portal-card-exp">Expiration (MM/YY)</label>
                    <input
                      id="portal-card-exp"
                      className="mkt-input"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/YY"
                      value={card.expiry}
                      onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    />
                  </div>
                  <div className="mkt-field">
                    <label htmlFor="portal-card-cvv">CVV</label>
                    <input
                      id="portal-card-cvv"
                      className="mkt-input"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      value={card.cvv}
                      onChange={(e) =>
                        setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                      }
                    />
                  </div>
                </div>
                <div className="mkt-profile-save-bar">
                  <button className="mkt-btn mkt-btn-primary" type="submit" disabled={saving}>
                    {saving ? "Saving…" : hasCard ? "Update card" : "Save card for automatic renewal"}
                  </button>
                  {hasCard && (
                    <button
                      className="mkt-btn mkt-btn-ghost"
                      type="button"
                      disabled={removing}
                      onClick={() => void removeCard()}
                    >
                      {removing ? "Removing…" : "Remove card"}
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {tab === "membership" && (
            <section className="mkt-profile-card">
              <div className="mkt-profile-card-head">
                <h2>Membership</h2>
                <p>Contact details on file with the office.</p>
              </div>
              <span className={`mkt-profile-badge mkt-profile-badge--${status.kind} mkt-profile-status`}>
                {status.text} membership
              </span>
              <dl className="mkt-profile-stats mkt-profile-stats--portal">
                <div>
                  <dt>Name</dt>
                  <dd>{displayName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{me.email || "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{me.phone || "—"}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{formatAddress(me) || "—"}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>
                    {me.membershipPlanLabel || "Standard membership"} · {fee} per year
                  </dd>
                </div>
                <div>
                  <dt>Next renewal date</dt>
                  <dd>{formatBillingDate(me.nextAnnualBillingDate)}</dd>
                </div>
              </dl>
              <p className="mkt-profile-readonly-note">
                To change your name, address, phone, or email, contact the office. You can add or replace a card
                on the Payment tab.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
