import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type Me = {
  email: string;
  firstName: string;
  lastName: string;
  memberNumber?: string;
  status?: string;
  nextAnnualBillingDate?: string;
  cardLast4?: string;
  cardOnFile?: boolean;
  role?: string;
};

function membershipLabel(status?: string): { text: string; kind: "ok" | "warn" } {
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
      setMe((m) => (m ? { ...m, cardLast4: res.cardLast4, cardOnFile: res.cardOnFile } : m));
      setCard({ number: "", expiry: "", cvv: "" });
      setOk(res.cardLast4 ? `Card ending in ${res.cardLast4} is on file.` : "Card saved.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not save card");
    } finally {
      setSaving(false);
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

  const status = membershipLabel(me.status);
  const hasCard = Boolean(me.cardOnFile && me.cardLast4);
  const displayName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;

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
              <dt>Next billing date</dt>
              <dd>{formatBillingDate(me.nextAnnualBillingDate)}</dd>
            </div>
          </dl>
        </section>

        <section className="mkt-profile-card">
          <div className="mkt-profile-card-head">
            <h2>{hasCard ? "Update card on file" : "Add a card on file"}</h2>
            <p>
              {hasCard
                ? `We have a card ending in ${me.cardLast4}. Enter a new credit or debit card to replace it.`
                : "Save a credit or debit card for annual membership billing. We never store the full card number."}
            </p>
          </div>
          {hasCard && (
            <p className="mkt-profile-card-onfile">
              Card on file <strong>•••• {me.cardLast4}</strong>
            </p>
          )}
          <form onSubmit={(e) => void saveCard(e)}>
            <div className="mkt-profile-grid">
              <div className="mkt-field mkt-profile-span-2">
                <label htmlFor="portal-card-number">Card number</label>
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
                {saving ? "Saving…" : hasCard ? "Update card" : "Save card"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
