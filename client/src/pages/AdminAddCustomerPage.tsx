import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type OilCo = { _id: string; name: string };

const rowStyle = { display: "flex", flexWrap: "wrap" as const, alignItems: "end", gap: "0.35rem 0.7rem" };

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

function Field({
  label,
  width,
  children,
}: {
  label: string;
  width: string;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        flex: "0 0 auto",
        width,
        display: "flex",
        flexDirection: "column",
        gap: "0.12rem",
        fontSize: "0.56rem",
        fontWeight: 600,
        color: "var(--wb-muted)",
        letterSpacing: "0.03em",
        minWidth: 0,
      }}
    >
      {label}
      {children}
    </label>
  );
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

  if (success) {
    return (
      <div className="admin-workbench">
        <header className="admin-wb-header">
          <div className="admin-wb-header-left">
            <span className="admin-wb-count" style={{ fontWeight: 600, color: "var(--wb-text)" }}>
              Customer created
            </span>
          </div>
        </header>
        <div className="admin-wb-body">
          <div className="admin-wb-panel" style={{ maxWidth: "520px" }}>
            <p className="admin-add-customer-success-msg">
              <strong>{success.name}</strong>
              {success.memberNumber ? ` · ${success.memberNumber}` : ""}
            </p>
            <div className="admin-wb-actions" style={{ padding: "0.35rem 0 0", border: "none", background: "transparent" }}>
              <Link to={`/admin/members/${success.id}`} className="admin-wb-btn admin-wb-btn-primary">
                View member
              </Link>
              <Link to={`/admin/workbench?member=${success.id}`} className="admin-wb-btn admin-wb-btn-secondary">
                Workbench
              </Link>
              <button type="button" className="admin-wb-btn" onClick={resetForm}>
                Add another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-workbench">
      <header className="admin-wb-header">
        <div className="admin-wb-header-left">
          <span className="admin-wb-count" style={{ fontWeight: 600, color: "var(--wb-text)" }}>
            Add Customer
          </span>
          <span className="admin-wb-count">Phone signup · same as website</span>
        </div>
      </header>

      <form onSubmit={onSubmit}>
        <div className="admin-wb-actions">
          <button type="submit" className="admin-wb-btn admin-wb-btn-success" disabled={loading}>
            {loading
              ? "Processing…"
              : form.paymentMethod === "card"
                ? "Charge & create"
                : "Create account"}
          </button>
          <button type="button" className="admin-wb-btn admin-wb-btn-secondary" onClick={() => navigate("/admin/members")}>
            Cancel
          </button>
          {err && <span className="admin-add-customer-err">{err}</span>}
        </div>

        <div className="admin-wb-body">
          <div className="admin-wb-grid">
            <div className="admin-wb-col">
              <div className="admin-wb-panel">
                <h2 className="admin-wb-panel-title">Contact</h2>
                <div className="admin-form-grid-4">
                  <div className="admin-form-span-4" style={rowStyle}>
                    <Field label="First" width="120px">
                      <input
                        className="admin-input"
                        required
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      />
                    </Field>
                    <Field label="Last" width="120px">
                      <input
                        className="admin-input"
                        required
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      />
                    </Field>
                    <Field label="Phone" width="130px">
                      <input
                        className="admin-input"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="admin-form-span-4" style={rowStyle}>
                    <Field label="Email" width="220px">
                      <input
                        className="admin-input"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </Field>
                    <Field label="Password" width="140px">
                      <input
                        className="admin-input"
                        type="password"
                        required
                        minLength={8}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="admin-wb-panel">
                <h2 className="admin-wb-panel-title">Address</h2>
                <div className="admin-form-grid-4">
                  <div className="admin-form-span-4" style={rowStyle}>
                    <Field label="Street" width="min(100%, 280px)">
                      <input
                        className="admin-input"
                        style={{ width: "100%" }}
                        value={form.addressLine1}
                        onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                      />
                    </Field>
                    <Field label="City" width="120px">
                      <input
                        className="admin-input"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </Field>
                    <Field label="St" width="50px">
                      <input
                        className="admin-input"
                        maxLength={2}
                        value={form.state}
                        onChange={(e) =>
                          setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })
                        }
                      />
                    </Field>
                    <Field label="Zip" width="80px">
                      <input
                        className="admin-input"
                        maxLength={10}
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-wb-col">
              <div className="admin-wb-panel">
                <h2 className="admin-wb-panel-title">Assignment</h2>
                <div className="admin-form-grid-4">
                  <div className="admin-form-span-4" style={rowStyle}>
                    <Field label="Oil co" width="min(100%, 200px)">
                      <select
                        className="admin-input"
                        style={{ width: "100%" }}
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
                    </Field>
                    <Field label="Referrer" width="min(100%, 200px)">
                      <input
                        className="admin-input"
                        style={{ width: "100%" }}
                        value={form.referrerToken}
                        onChange={(e) => setForm({ ...form, referrerToken: e.target.value })}
                        placeholder="email or member #"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="admin-wb-panel">
                <h2 className="admin-wb-panel-title">Payment</h2>
                <div className="admin-form-grid-4">
                  <div className="admin-form-span-4" style={rowStyle}>
                    <Field label="Method" width="200px">
                      <select
                        className="admin-input"
                        style={{ width: "100%" }}
                        value={form.paymentMethod}
                        onChange={(e) =>
                          setForm({ ...form, paymentMethod: e.target.value as "card" | "check" })
                        }
                      >
                        <option value="card">Card (auto-renew)</option>
                        <option value="check">Check (manual renew)</option>
                      </select>
                    </Field>
                  </div>

                  {form.paymentMethod === "card" && (
                    <div className="admin-form-span-4" style={rowStyle}>
                      <Field label="Card #" width="min(100%, 200px)">
                        <input
                          className="admin-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="1234 5678 9012 3456"
                          style={{ width: "100%", fontFamily: "monospace" }}
                          value={form.cardNumber}
                          onChange={(e) => setForm({ ...form, cardNumber: formatCardNumber(e.target.value) })}
                          maxLength={19}
                          required
                        />
                      </Field>
                      <Field label="Exp" width="70px">
                        <input
                          className="admin-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="MM/YY"
                          style={{ fontFamily: "monospace" }}
                          value={form.cardExpiry}
                          onChange={(e) => setForm({ ...form, cardExpiry: formatExpiry(e.target.value) })}
                          maxLength={5}
                          required
                        />
                      </Field>
                      <Field label="CVV" width="55px">
                        <input
                          className="admin-input"
                          type="text"
                          inputMode="numeric"
                          style={{ fontFamily: "monospace" }}
                          value={form.cardCvv}
                          onChange={(e) =>
                            setForm({ ...form, cardCvv: e.target.value.replace(/\D/g, "").slice(0, 4) })
                          }
                          maxLength={4}
                          required
                        />
                      </Field>
                    </div>
                  )}

                  {form.paymentMethod === "check" && (
                    <p className="admin-add-customer-inline-note admin-form-span-4">
                      Check: account pending until registration fee received; renewals by mail each year.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
