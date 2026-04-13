import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

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
    // Card fields for Authorize.Net
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  });

  function formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    // Validate card fields if paying by card
    if (form.paymentMethod === "card") {
      const cardDigits = form.cardNumber.replace(/\D/g, "");
      if (cardDigits.length < 13) {
        setErr("Please enter a valid card number");
        return;
      }
      const expiryDigits = form.cardExpiry.replace(/\D/g, "");
      if (expiryDigits.length !== 4) {
        setErr("Please enter a valid expiration date (MM/YY)");
        return;
      }
      if (form.cardCvv.length < 3) {
        setErr("Please enter a valid CVV");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        addressLine1: form.addressLine1,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        paymentMethod: form.paymentMethod,
        referrerToken: form.referrerToken,
        // Only include card data if paying by card
        ...(form.paymentMethod === "card" && {
          cardNumber: form.cardNumber.replace(/\s/g, ""),
          cardExpiry: form.cardExpiry.replace("/", ""),
          cardCvv: form.cardCvv,
        }),
      };

      const res = await api<{ token: string; member: Record<string, unknown> }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
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
        You&apos;ll be charged the registration fee right away. Annual membership is billed each June 1.
        Staff assigns your oil company after signup.
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
            <label>Payment method</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as "card" | "check" })}
            >
              <option value="card">Credit/Debit Card (auto-renew enabled)</option>
              <option value="check">Check (manual renewal each year)</option>
            </select>
          </div>

          {form.paymentMethod === "card" && (
            <div className="mkt-card-section" style={{ background: "#f8f8f8", padding: "1rem", borderRadius: "8px", marginTop: "1rem" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Payment Information</h3>
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
                Your card will be charged the registration fee now and stored securely for annual renewals.
              </p>
              <div className="mkt-field">
                <label>Card number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  value={form.cardNumber}
                  onChange={(e) => setForm({ ...form, cardNumber: formatCardNumber(e.target.value) })}
                  maxLength={19}
                  required={form.paymentMethod === "card"}
                  style={{ fontFamily: "monospace" }}
                />
              </div>
              <div className="mkt-row2">
                <div className="mkt-field">
                  <label>Expiration (MM/YY)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    value={form.cardExpiry}
                    onChange={(e) => setForm({ ...form, cardExpiry: formatExpiry(e.target.value) })}
                    maxLength={5}
                    required={form.paymentMethod === "card"}
                    style={{ fontFamily: "monospace" }}
                  />
                </div>
                <div className="mkt-field">
                  <label>CVV</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123"
                    value={form.cardCvv}
                    onChange={(e) => setForm({ ...form, cardCvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    maxLength={4}
                    required={form.paymentMethod === "card"}
                    style={{ fontFamily: "monospace", maxWidth: "100px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {form.paymentMethod === "check" && (
            <div style={{ background: "#fff8e6", padding: "1rem", borderRadius: "8px", marginTop: "1rem", border: "1px solid #f0d070" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#665" }}>
                <strong>Check payment:</strong> Your account will be created but marked as pending.
                Mail your registration fee check to the office address. Annual renewals will also require mailing a check each year.
              </p>
            </div>
          )}

          {err && <p className="mkt-error">{err}</p>}
          <button type="submit" className="mkt-btn mkt-btn-primary" disabled={loading} style={{ marginTop: "1rem" }}>
            {loading ? "Processing…" : form.paymentMethod === "card" ? "Pay & Create Account" : "Create Account"}
          </button>
        </form>
      </div>
      <p className="mkt-lead" style={{ marginTop: "1.5rem", marginBottom: 0 }}>
        Already a member? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
