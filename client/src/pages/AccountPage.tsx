import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";
import { formatUsdFromCents } from "../utils/membershipFees";

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
  if (status === "expired") return { text: "Expired membership", kind: "warn" };
  if (status === "cancelled") return { text: "Cancelled membership", kind: "warn" };
  return { text: "Active membership", kind: "ok" };
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

export default function AccountPage() {
  const { token, member, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
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

  return (
    <div className="mkt-profile">
      <header className="mkt-profile-header">
        <div className="mkt-profile-header-inner mkt-profile-header-inner--portal">
          <div>
            <p className="mkt-profile-eyebrow">Member portal</p>
            <h1 className="mkt-profile-name">{displayName}</h1>
            <p className="mkt-profile-meta">Member #{me.memberNumber || "—"}</p>
          </div>
          <div className="mkt-profile-header-actions">
            {member?.role === "admin" && (
              <Link to="/admin/members" className="mkt-btn mkt-btn-ghost">
                Admin console
              </Link>
            )}
            <button type="button" className="mkt-btn mkt-btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mkt-profile-body mkt-profile-body--portal">
        {err && <p className="mkt-error">{err}</p>}
        {ok && <p className="mkt-profile-ok">{ok}</p>}

        <section className="mkt-profile-card">
          <span className={`mkt-profile-badge mkt-profile-badge--${status.kind} mkt-profile-status`}>
            {status.text}
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
              <dt>Membership / renewal fee</dt>
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
            below for automatic renewal.
          </p>
        </section>

        <section className="mkt-profile-card">
          <div className="mkt-profile-card-head">
            <h2>Payment information</h2>
            <p>
              Cards are stored with our processor for June automatic renewal. We never keep the full card number
              in our database.
            </p>
          </div>
          {hasCard ? (
            <p className="mkt-profile-card-onfile">
              Card on file <strong>•••• {me.cardLast4}</strong>
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
      </div>
    </div>
  );
}
