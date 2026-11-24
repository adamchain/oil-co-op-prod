import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

type LinkDetails = {
  amountCents: number;
  billingYear?: number;
  member: { firstName: string; lastName: string; memberNumber?: string };
};

function formatCard(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return (digits.match(/.{1,4}/g) ?? []).join("-");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function PayMembershipPage() {
  const { token = "" } = useParams();
  const [details, setDetails] = useState<LinkDetails | null>(null);
  const [loadError, setLoadError] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!token) return;
    api<LinkDetails>(`/api/payments/link/${token}`)
      .then(setDetails)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "This payment link is not available."));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const digits = number.replace(/\D/g, "");
    const exp = expiry.replace(/\D/g, "");
    if (digits.length < 13 || exp.length !== 4 || cvv.length < 3) {
      setError("Enter the card number, expiration, and security code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ mock?: boolean; transactionId?: string }>(`/api/payments/link/${token}/pay`, {
        method: "POST",
        body: JSON.stringify({ cardNumber: digits, expiration: exp, cvv, saveCard }),
      });
      setDone(
        r.mock
          ? "Payment recorded. The card processor is not connected in this environment, so the card was not charged."
          : `Payment received${r.transactionId ? `. Transaction ${r.transactionId}` : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payment did not go through.");
    } finally {
      setBusy(false);
    }
  }

  const amount = details ? `$${(details.amountCents / 100).toFixed(2)}` : "";

  return (
    <main style={{ maxWidth: 480, margin: "2.5rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif", color: "#1c1917" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.4rem" }}>Membership payment</h1>
      {loadError && <p style={{ color: "#b91c1c" }}>{loadError}</p>}
      {!loadError && !details && <p>Loading…</p>}
      {details && done && (
        <p>
          Thank you, {details.member.firstName}. {done}
          {saveCard ? " This card is saved for auto-renew." : " This card was not saved."}
        </p>
      )}
      {details && !done && (
        <form onSubmit={(e) => void submit(e)} style={{ display: "grid", gap: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            {details.member.firstName} {details.member.lastName}
            {details.member.memberNumber ? ` · ${details.member.memberNumber}` : ""}
            {details.billingYear ? ` · ${details.billingYear}` : ""}
          </p>
          <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>{amount}</p>
          <label>
            Card number
            <input value={number} onChange={(e) => setNumber(formatCard(e.target.value))} inputMode="numeric" autoComplete="off" style={{ display: "block", width: "100%", marginTop: 4, padding: "0.45rem" }} />
          </label>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <label style={{ flex: 1 }}>
              Exp
              <input value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" inputMode="numeric" autoComplete="off" style={{ display: "block", width: "100%", marginTop: 4, padding: "0.45rem" }} />
            </label>
            <label style={{ width: 100 }}>
              CVV
              <input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" style={{ display: "block", width: "100%", marginTop: 4, padding: "0.45rem" }} />
            </label>
          </div>
          <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
            <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
            Save this card and turn on auto-renew
          </label>
          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ background: "#14703B", color: "#fff", border: 0, borderRadius: 6, padding: "0.6rem 1rem", fontWeight: 700 }}>
            {busy ? "Processing…" : `Pay ${amount}`}
          </button>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#57534e" }}>
            Leave the box unchecked to make this a one-time payment. The card is not saved.
          </p>
        </form>
      )}
    </main>
  );
}
