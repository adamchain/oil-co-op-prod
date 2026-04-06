import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type Me = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  memberNumber?: string;
  nextAnnualBillingDate?: string;
  oilCompanyId?: string | null;
  role?: string;
  successfulReferralCount?: number;
  lifetimeAnnualFeeWaived?: boolean;
  referralWaiveCredits?: number;
  notificationSettings?: Record<string, boolean | string>;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  legacyProfile?: Record<string, unknown>;
};

export default function AccountPage() {
  const { token, member } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    email2: "",
    phone2: "",
    phone3: "",
    employer: "",
  });

  useEffect(() => {
    if (!token) return;
    api<Me>("/api/auth/me", { token })
      .then((m) => {
        setMe(m);
        setProfile({
          firstName: m.firstName || "",
          lastName: m.lastName || "",
          phone: m.phone || "",
          addressLine1: m.addressLine1 || "",
          addressLine2: m.addressLine2 || "",
          city: m.city || "",
          state: m.state || "",
          postalCode: m.postalCode || "",
          email2: String(m.legacyProfile?.email2 ?? ""),
          phone2: String(m.legacyProfile?.phone2 ?? ""),
          phone3: String(m.legacyProfile?.phone3 ?? ""),
          employer: String(m.legacyProfile?.employer ?? ""),
        });
      })
      .catch((e) => setErr(String(e.message)));
  }, [token]);

  const ns = me?.notificationSettings || {};

  async function updateNs(patch: Record<string, boolean | string>) {
    if (!token) return;
    setSaving(true);
    setErr("");
    try {
      const res = await api<{ notificationSettings: Record<string, boolean | string> }>(
        "/api/me/notification-settings",
        { method: "PATCH", body: JSON.stringify(patch), token }
      );
      setMe((m) => (m ? { ...m, notificationSettings: res.notificationSettings } : m));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!token) return;
    setProfileSaving(true);
    setErr("");
    try {
      const res = await api<{ member: Partial<Me> & { legacyProfile?: Record<string, unknown> } }>(
        "/api/me/profile",
        {
          method: "PATCH",
          token,
          body: JSON.stringify({
            firstName: profile.firstName,
            lastName: profile.lastName,
            phone: profile.phone,
            addressLine1: profile.addressLine1,
            addressLine2: profile.addressLine2,
            city: profile.city,
            state: profile.state,
            postalCode: profile.postalCode,
            legacyProfile: {
              email2: profile.email2,
              phone2: profile.phone2,
              phone3: profile.phone3,
              employer: profile.employer,
            },
          }),
        }
      );
      setMe((m) => (m ? { ...m, ...res.member, legacyProfile: { ...(m.legacyProfile || {}), ...(res.member.legacyProfile || {}) } } : m));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setProfileSaving(false);
    }
  }

  if (!me) {
    return (
      <div className="mkt-panel">
        {err ? <p className="mkt-error">{err}</p> : <p className="mkt-lead">Loading…</p>}
      </div>
    );
  }

  const next = me.nextAnnualBillingDate ? new Date(me.nextAnnualBillingDate) : null;

  return (
    <div className="mkt-panel" style={{ maxWidth: "720px" }}>
      <h1 className="mkt-page-title">Hello, {me.firstName}</h1>
      <p className="mkt-lead">
        Member #<strong>{me.memberNumber}</strong>
        {next && (
          <>
            {" "}
            · Next June billing: <strong>{next.toLocaleDateString()}</strong>
          </>
        )}
      </p>
      {member?.role === "admin" && (
        <p className="mkt-lead">
          <Link to="/admin/members">Open admin console</Link>
        </p>
      )}
      {!me.oilCompanyId && (
        <div className="mkt-card-form" style={{ marginBottom: "1.25rem", borderLeft: "4px solid var(--color-accent)" }}>
          <p className="mkt-lead" style={{ margin: 0 }}>
            Your oil company isn&apos;t assigned yet. Staff will select it in the admin system and you&apos;ll get an
            email when it&apos;s set.
          </p>
        </div>
      )}
      <p className="mkt-lead">
        Referrals: <strong>{me.successfulReferralCount ?? 0}</strong> · Waive credits:{" "}
        <strong>{me.referralWaiveCredits ?? 0}</strong> · Lifetime annual waiver:{" "}
        <strong>{me.lifetimeAnnualFeeWaived ? "Yes" : "No"}</strong>
      </p>

      <div className="mkt-card-form">
        <h2 className="mkt-section-title" style={{ textAlign: "left", fontSize: "1.25rem", marginBottom: "0.35rem" }}>
          Customer profile
        </h2>
        <p className="mkt-lead" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          Includes legacy profile/contact fields used by admin workbench.
        </p>
        <div className="mkt-grid two">
          <label>First name<input className="mkt-input" value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} /></label>
          <label>Last name<input className="mkt-input" value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} /></label>
          <label>Phone 1<input className="mkt-input" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} /></label>
          <label>Phone 2<input className="mkt-input" value={profile.phone2} onChange={(e) => setProfile((p) => ({ ...p, phone2: e.target.value }))} /></label>
          <label>Phone 3<input className="mkt-input" value={profile.phone3} onChange={(e) => setProfile((p) => ({ ...p, phone3: e.target.value }))} /></label>
          <label>Email 2<input className="mkt-input" value={profile.email2} onChange={(e) => setProfile((p) => ({ ...p, email2: e.target.value }))} /></label>
          <label>Address line 1<input className="mkt-input" value={profile.addressLine1} onChange={(e) => setProfile((p) => ({ ...p, addressLine1: e.target.value }))} /></label>
          <label>Address line 2<input className="mkt-input" value={profile.addressLine2} onChange={(e) => setProfile((p) => ({ ...p, addressLine2: e.target.value }))} /></label>
          <label>City<input className="mkt-input" value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} /></label>
          <label>State<input className="mkt-input" value={profile.state} onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))} /></label>
          <label>ZIP<input className="mkt-input" value={profile.postalCode} onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))} /></label>
          <label>Employer<input className="mkt-input" value={profile.employer} onChange={(e) => setProfile((p) => ({ ...p, employer: e.target.value }))} /></label>
        </div>
        <button className="mkt-submit" type="button" onClick={() => void saveProfile()} disabled={profileSaving}>
          {profileSaving ? "Saving..." : "Save profile"}
        </button>
      </div>

      <div className="mkt-card-form">
        <h2 className="mkt-section-title" style={{ textAlign: "left", fontSize: "1.25rem", marginBottom: "0.35rem" }}>
          Notification settings
        </h2>
        <p className="mkt-lead" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          Email and SMS preferences sync with the same fields staff see in reporting. June 1 reminders: 30, 7, and 1
          day before your billing date when renewal reminders are on.
        </p>
        {err && <p className="mkt-error">{err}</p>}
        <div className="mkt-toggle-list">
          <Toggle
            label="Email — master switch"
            checked={Boolean(ns.emailEnabled)}
            onChange={(v) => updateNs({ emailEnabled: v })}
            disabled={saving}
          />
          <Toggle
            label="Renewal reminders (30 / 7 / 1 days)"
            checked={Boolean(ns.renewalReminders)}
            onChange={(v) => updateNs({ renewalReminders: v })}
            disabled={saving || !ns.emailEnabled}
          />
          <Toggle
            label="Billing notices"
            checked={Boolean(ns.billingNotices)}
            onChange={(v) => updateNs({ billingNotices: v })}
            disabled={saving || !ns.emailEnabled}
          />
          <Toggle
            label="Oil company updates"
            checked={Boolean(ns.oilCompanyUpdates)}
            onChange={(v) => updateNs({ oilCompanyUpdates: v })}
            disabled={saving || !ns.emailEnabled}
          />
          <Toggle
            label="Marketing / newsletter"
            checked={Boolean(ns.marketing)}
            onChange={(v) => updateNs({ marketing: v })}
            disabled={saving || !ns.emailEnabled}
          />
          <Toggle
            label="SMS (when available)"
            checked={Boolean(ns.smsEnabled)}
            onChange={(v) => updateNs({ smsEnabled: v })}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mkt-toggle-row" style={{ cursor: disabled ? "default" : "pointer" }}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
