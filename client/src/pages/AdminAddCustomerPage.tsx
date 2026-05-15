import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCo = { _id: string; name: string };

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

export default function AdminAddCustomerPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [oilCos, setOilCos] = useState<OilCo[]>([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState<{ id: string; memberNumber?: string; name: string } | null>(null);
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
    oilCompanyId: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  });

  useEffect(() => {
    if (!token) return;
    api<{ oilCompanies: OilCo[] }>("/api/admin/oil-companies", { token }).then((r) =>
      setOilCos(r.oilCompanies)
    );
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSuccess(null);

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
        oilCompanyId: form.oilCompanyId || null,
        ...(form.paymentMethod === "card" && {
          cardNumber: form.cardNumber.replace(/\s/g, ""),
          cardExpiry: form.cardExpiry.replace("/", ""),
          cardCvv: form.cardCvv,
        }),
      };

      const res = await api<{
        member: {
          _id: string;
          memberNumber?: string;
          firstName: string;
          lastName: string;
        };
      }>("/api/admin/members/register", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });

      setSuccess({
        id: res.member._id,
        memberNumber: res.member.memberNumber,
        name: `${res.member.firstName} ${res.member.lastName}`.trim(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create customer");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      paymentMethod: "card",
      referrerToken: "",
      oilCompanyId: "",
      cardNumber: "",
      cardExpiry: "",
      cardCvv: "",
    });
    setSuccess(null);
    setErr("");
  }

  return (
    <>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 600 }}>Add Customer</h1>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.875rem", margin: "0 0 1.25rem", maxWidth: "42rem" }}>
        Phone signup — same fields as the public website registration. Assign an oil company now or leave blank
        and assign later from the member record.
      </p>

      {success ? (
        <div className="admin-card">
          <p style={{ margin: "0 0 0.75rem" }}>
            <strong>{success.name}</strong> was created
            {success.memberNumber ? ` (${success.memberNumber})` : ""}.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <Link to={`/admin/members/${success.id}`} className="admin-btn admin-btn-primary">
              View member
            </Link>
            <Link to={`/admin/workbench?member=${success.id}`} className="admin-btn">
              Open in workbench
            </Link>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={resetForm}>
              Add another
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-card">
          <form onSubmit={onSubmit} className="admin-add-customer-form">
            <div className="admin-form-grid">
              <label>
                First name
                <input
                  className="admin-input"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </label>
              <label>
                Last name
                <input
                  className="admin-input"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </label>
              <label className="admin-form-span-2">
                Email
                <input
                  className="admin-input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="admin-form-span-2">
                Password (min 8 characters)
                <input
                  className="admin-input"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              <label className="admin-form-span-2">
                Phone
                <input
                  className="admin-input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="admin-form-span-2">
                Street address
                <input
                  className="admin-input"
                  value={form.addressLine1}
                  onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                />
              </label>
              <label>
                City
                <input
                  className="admin-input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </label>
              <label>
                State
                <input
                  className="admin-input"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </label>
              <label>
                ZIP
                <input
                  className="admin-input"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                />
              </label>
              <label>
                Oil company <span style={{ fontWeight: 400, color: "var(--admin-muted)" }}>(optional)</span>
                <select
                  className="admin-input"
                  value={form.oilCompanyId}
                  onChange={(e) => setForm({ ...form, oilCompanyId: e.target.value })}
                >
                  <option value="">Assign later</option>
                  {oilCos.map((oc) => (
                    <option key={oc._id} value={oc._id}>
                      {oc.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-form-span-2">
                Referrer — name, email, or member # (optional)
                <input
                  className="admin-input"
                  value={form.referrerToken}
                  onChange={(e) => setForm({ ...form, referrerToken: e.target.value })}
                  placeholder="e.g. friend@email.com or OC-2026-0001"
                />
              </label>
              <label className="admin-form-span-2">
                Payment method
                <select
                  className="admin-input"
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm({ ...form, paymentMethod: e.target.value as "card" | "check" })
                  }
                >
                  <option value="card">Credit/Debit Card (auto-renew enabled)</option>
                  <option value="check">Check (manual renewal each year)</option>
                </select>
              </label>
            </div>

            {form.paymentMethod === "card" && (
              <div className="admin-add-customer-payment">
                <h2>Payment information</h2>
                <p>
                  Card is charged the registration fee now and stored for annual renewals, same as website signup.
                </p>
                <div className="admin-form-grid">
                  <label className="admin-form-span-2">
                    Card number
                    <input
                      className="admin-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={form.cardNumber}
                      onChange={(e) => setForm({ ...form, cardNumber: formatCardNumber(e.target.value) })}
                      maxLength={19}
                      required
                      style={{ fontFamily: "monospace" }}
                    />
                  </label>
                  <label>
                    Expiration (MM/YY)
                    <input
                      className="admin-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={form.cardExpiry}
                      onChange={(e) => setForm({ ...form, cardExpiry: formatExpiry(e.target.value) })}
                      maxLength={5}
                      required
                      style={{ fontFamily: "monospace" }}
                    />
                  </label>
                  <label>
                    CVV
                    <input
                      className="admin-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      value={form.cardCvv}
                      onChange={(e) =>
                        setForm({ ...form, cardCvv: e.target.value.replace(/\D/g, "").slice(0, 4) })
                      }
                      maxLength={4}
                      required
                      style={{ fontFamily: "monospace", maxWidth: "120px" }}
                    />
                  </label>
                </div>
              </div>
            )}

            {form.paymentMethod === "check" && (
              <div className="admin-add-customer-check-note">
                <p>
                  <strong>Check payment:</strong> Account is created with payment pending. Member mails the
                  registration fee; annual renewals also require a check each year.
                </p>
              </div>
            )}

            {err && (
              <p style={{ color: "#b91c1c", margin: "1rem 0 0", fontSize: "0.875rem" }}>{err}</p>
            )}

            <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
                {loading
                  ? "Processing…"
                  : form.paymentMethod === "card"
                    ? "Charge & create account"
                    : "Create account"}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => navigate("/admin/members")}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
