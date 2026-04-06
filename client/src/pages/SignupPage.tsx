import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type IntentRes =
  | { mock: true; amountCents: number }
  | { clientSecret: string; paymentIntentId: string; amountCents: number };

export default function SignupPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    paymentMethod: "card" as "card" | "check",
    referrerToken: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const intent = await api<IntentRes>("/api/auth/registration-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptEmail: form.email }),
      });

      let paymentIntentId: string | undefined;
      if (!("mock" in intent && intent.mock === true)) {
        setErr(
          "Stripe is enabled on the server. Complete Payment Element integration with the returned clientSecret, then pass paymentIntentId to register. For local dev, leave STRIPE_SECRET_KEY unset."
        );
        setLoading(false);
        return;
      }

      const res = await api<{ token: string; member: Record<string, unknown> }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...form, paymentIntentId }),
      });
      setSession(
        res.token,
        res.member as {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          memberNumber?: string;
          role?: string;
        }
      );
      nav("/account");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mkt-panel">
      <h1 className="mkt-page-title">Join Citizen&apos;s Oil Co-op</h1>
      <p className="mkt-lead">
        You&apos;ll be charged the registration fee right away. Annual membership is billed each June 1 (your first
        June bill follows the rules we use in the admin system). Staff assigns your oil company after signup — the
        same data appears in the admin console.
      </p>
      <div className="mkt-card-form">
        <form onSubmit={onSubmit}>
          <div className="mkt-row2">
            <div className="mkt-field">
              <label>First name</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div className="mkt-field">
              <label>Last name</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="mkt-field">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="mkt-field">
            <label>Password (min 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="mkt-field">
            <label>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="mkt-field">
            <label>Street address</label>
            <input
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            />
          </div>
          <div className="mkt-row2">
            <div className="mkt-field">
              <label>City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="mkt-field">
              <label>State</label>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
          </div>
          <div className="mkt-field">
            <label>ZIP</label>
            <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <div className="mkt-field">
            <label>Referrer — name, email, or member # (optional)</label>
            <input
              value={form.referrerToken}
              onChange={(e) => setForm({ ...form, referrerToken: e.target.value })}
              placeholder="e.g. friend@email.com or OC-2026-0001"
            />
          </div>
          <div className="mkt-field">
            <label>Payment preference</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as "card" | "check" })}
            >
              <option value="card">Card (auto-renew when card on file)</option>
              <option value="check">Check</option>
            </select>
          </div>
          {err && <p className="mkt-error">{err}</p>}
          <button type="submit" className="mkt-btn mkt-btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Working…" : "Pay registration & create account"}
          </button>
        </form>
      </div>
      <p className="mkt-lead" style={{ marginTop: "1.5rem", marginBottom: 0 }}>
        Already a member? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
