import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";
import { PENDING_PROPERTY_KEY, type PendingProperty } from "../utils/pendingProperty";

type Property = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  isPrimary: boolean;
};

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
  properties?: Property[];
  legacyProfile?: Record<string, unknown>;
};

function initials(first: string, last: string, email: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase();
  return (email.trim().charAt(0) || "?").toUpperCase();
}

function formatAddress(p: {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): string {
  return [p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.postalCode]
    .filter(Boolean)
    .join(", ");
}

export default function AccountPage() {
  const { token, member, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [addingProperty, setAddingProperty] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newProperty, setNewProperty] = useState({
    label: "Additional property",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
  });
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

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_PROPERTY_KEY);
      if (!raw) return;
      const pending = JSON.parse(raw) as PendingProperty;
      if (!pending?.addressLine1) return;
      setNewProperty({
        label: pending.label || "Additional property",
        addressLine1: pending.addressLine1 || "",
        addressLine2: pending.addressLine2 || "",
        city: pending.city || "",
        state: pending.state || "",
        postalCode: pending.postalCode || "",
      });
      setShowAddProperty(true);
      sessionStorage.removeItem(PENDING_PROPERTY_KEY);
      // Scroll to addresses after paint
      window.setTimeout(() => {
        document.getElementById("profile-address")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch {
      sessionStorage.removeItem(PENDING_PROPERTY_KEY);
    }
  }, []);

  const ns = me?.notificationSettings || {};
  const properties = me?.properties?.length
    ? me.properties
    : me?.addressLine1
      ? [
          {
            id: "primary",
            label: "Primary",
            addressLine1: me.addressLine1 || "",
            addressLine2: me.addressLine2 || "",
            city: me.city || "",
            state: me.state || "",
            postalCode: me.postalCode || "",
            isPrimary: true,
          },
        ]
      : [];

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
      setMe((m) =>
        m
          ? {
              ...m,
              ...res.member,
              properties: res.member.properties ?? m.properties,
              legacyProfile: { ...(m.legacyProfile || {}), ...(res.member.legacyProfile || {}) },
            }
          : m
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setProfileSaving(false);
    }
  }

  async function addProperty() {
    if (!token) return;
    if (!newProperty.addressLine1.trim() || !newProperty.city.trim() || !newProperty.state.trim() || !newProperty.postalCode.trim()) {
      setErr("Please fill in the property address, city, state, and ZIP.");
      return;
    }
    setAddingProperty(true);
    setErr("");
    try {
      const res = await api<{ properties: Property[] }>("/api/me/properties", {
        method: "POST",
        token,
        body: JSON.stringify(newProperty),
      });
      setMe((m) => (m ? { ...m, properties: res.properties } : m));
      setNewProperty({
        label: "Additional property",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
      });
      setShowAddProperty(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add property");
    } finally {
      setAddingProperty(false);
    }
  }

  if (!me) {
    return (
      <div className="mkt-profile">
        <div className="mkt-profile-loading">
          {err ? <p className="mkt-error">{err}</p> : <p className="mkt-lead">Loading your profile…</p>}
        </div>
      </div>
    );
  }

  const next = me.nextAnnualBillingDate ? new Date(me.nextAnnualBillingDate) : null;
  const displayName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;
  const cityState = [me.city, me.state].filter(Boolean).join(", ");

  return (
    <div className="mkt-profile">
      <header className="mkt-profile-header">
        <div className="mkt-profile-header-inner">
          <div className="mkt-profile-identity">
            <div className="mkt-profile-avatar" aria-hidden>
              {initials(me.firstName, me.lastName, me.email)}
            </div>
            <div className="mkt-profile-identity-text">
              <p className="mkt-profile-eyebrow">Member profile</p>
              <h1 className="mkt-profile-name">{displayName}</h1>
              <p className="mkt-profile-meta">
                <span>Member #{me.memberNumber || "—"}</span>
                <span className="mkt-profile-meta-sep" aria-hidden>
                  ·
                </span>
                <span>{me.email}</span>
                {cityState && (
                  <>
                    <span className="mkt-profile-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>{cityState}</span>
                  </>
                )}
              </p>
              <div className="mkt-profile-badges">
                {me.oilCompanyId ? (
                  <span className="mkt-profile-badge mkt-profile-badge--ok">Oil company assigned</span>
                ) : (
                  <span className="mkt-profile-badge mkt-profile-badge--warn">Oil company pending</span>
                )}
                {me.lifetimeAnnualFeeWaived && (
                  <span className="mkt-profile-badge mkt-profile-badge--ok">Lifetime annual waiver</span>
                )}
                {member?.role === "admin" && <span className="mkt-profile-badge">Admin</span>}
              </div>
            </div>
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

      <div className="mkt-profile-body">
        <aside className="mkt-profile-aside">
          <div className="mkt-profile-card mkt-profile-summary">
            <h2>Membership</h2>
            <dl className="mkt-profile-stats">
              <div>
                <dt>Member number</dt>
                <dd>{me.memberNumber || "—"}</dd>
              </div>
              <div>
                <dt>Next June billing</dt>
                <dd>{next ? next.toLocaleDateString() : "—"}</dd>
              </div>
              <div>
                <dt>Successful referrals</dt>
                <dd>{me.successfulReferralCount ?? 0}</dd>
              </div>
              <div>
                <dt>Waive credits</dt>
                <dd>{me.referralWaiveCredits ?? 0}</dd>
              </div>
              <div>
                <dt>Lifetime waiver</dt>
                <dd>{me.lifetimeAnnualFeeWaived ? "Yes" : "No"}</dd>
              </div>
            </dl>
            <Link to="/referral" className="mkt-profile-aside-link">
              Refer a friend →
            </Link>
          </div>

          {!me.oilCompanyId && (
            <div className="mkt-profile-card mkt-profile-notice">
              <h2>Oil company</h2>
              <p>
                Your oil company isn&apos;t assigned yet. Staff will select it in the admin system and you&apos;ll get an
                email when it&apos;s set.
              </p>
            </div>
          )}

          <nav className="mkt-profile-card mkt-profile-toc" aria-label="Profile sections">
            <h2>On this page</h2>
            <a href="#profile-personal">Personal information</a>
            <a href="#profile-contact">Contact</a>
            <a href="#profile-address">Addresses</a>
            <a href="#profile-notifications">Notifications</a>
          </nav>
        </aside>

        <div className="mkt-profile-main">
          {err && <p className="mkt-error">{err}</p>}

          <section className="mkt-profile-card" id="profile-personal">
            <div className="mkt-profile-card-head">
              <h2>Personal information</h2>
              <p>Name and employer details on your membership record.</p>
            </div>
            <div className="mkt-profile-grid">
              <div className="mkt-field">
                <label htmlFor="profile-first">First name</label>
                <input
                  id="profile-first"
                  className="mkt-input"
                  value={profile.firstName}
                  onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="profile-last">Last name</label>
                <input
                  id="profile-last"
                  className="mkt-input"
                  value={profile.lastName}
                  onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
              <div className="mkt-field mkt-profile-span-2">
                <label htmlFor="profile-employer">Employer</label>
                <input
                  id="profile-employer"
                  className="mkt-input"
                  value={profile.employer}
                  onChange={(e) => setProfile((p) => ({ ...p, employer: e.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="mkt-profile-card" id="profile-contact">
            <div className="mkt-profile-card-head">
              <h2>Contact</h2>
              <p>
                Primary email is <strong>{me.email}</strong>. Add phones and a secondary email below.
              </p>
            </div>
            <div className="mkt-profile-grid">
              <div className="mkt-field">
                <label htmlFor="profile-phone">Phone (primary)</label>
                <input
                  id="profile-phone"
                  className="mkt-input"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="profile-phone2">Phone (secondary)</label>
                <input
                  id="profile-phone2"
                  className="mkt-input"
                  type="tel"
                  value={profile.phone2}
                  onChange={(e) => setProfile((p) => ({ ...p, phone2: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="profile-phone3">Phone (other)</label>
                <input
                  id="profile-phone3"
                  className="mkt-input"
                  type="tel"
                  value={profile.phone3}
                  onChange={(e) => setProfile((p) => ({ ...p, phone3: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="profile-email2">Email (secondary)</label>
                <input
                  id="profile-email2"
                  className="mkt-input"
                  type="email"
                  value={profile.email2}
                  onChange={(e) => setProfile((p) => ({ ...p, email2: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </section>

          <section className="mkt-profile-card" id="profile-address">
            <div className="mkt-profile-card-head">
              <h2>Addresses</h2>
              <p>Primary mailing address and any additional properties on your membership.</p>
            </div>

            <h3 className="mkt-profile-subhead">Primary address</h3>
            <div className="mkt-profile-grid">
              <div className="mkt-field mkt-profile-span-2">
                <label htmlFor="profile-street">Street address</label>
                <input
                  id="profile-street"
                  className="mkt-input"
                  value={profile.addressLine1}
                  onChange={(e) => setProfile((p) => ({ ...p, addressLine1: e.target.value }))}
                />
              </div>
              <div className="mkt-field mkt-profile-span-2">
                <label htmlFor="profile-apt">Apt, suite, unit (optional)</label>
                <input
                  id="profile-apt"
                  className="mkt-input"
                  value={profile.addressLine2}
                  onChange={(e) => setProfile((p) => ({ ...p, addressLine2: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="profile-city">City</label>
                <input
                  id="profile-city"
                  className="mkt-input"
                  value={profile.city}
                  onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div className="mkt-profile-city-row">
                <div className="mkt-field">
                  <label htmlFor="profile-state">State</label>
                  <input
                    id="profile-state"
                    className="mkt-input"
                    value={profile.state}
                    onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
                    maxLength={2}
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
                <div className="mkt-field">
                  <label htmlFor="profile-zip">ZIP</label>
                  <input
                    id="profile-zip"
                    className="mkt-input"
                    value={profile.postalCode}
                    onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <h3 className="mkt-profile-subhead">Property addresses</h3>
            {showAddProperty && newProperty.addressLine1 && (
              <div className="mkt-modal-confirm" style={{ marginBottom: "1rem" }}>
                <p className="mkt-modal-confirm-label">Ready to save from signup</p>
                <p className="mkt-modal-confirm-address">
                  Review the address below and click Save property to add it to your membership.
                </p>
              </div>
            )}
            <div className="mkt-property-list">
              {properties.length === 0 ? (
                <p className="mkt-profile-empty">No property addresses on file yet.</p>
              ) : (
                properties.map((p) => (
                  <div key={p.id || `${p.addressLine1}-${p.postalCode}`} className="mkt-property-item">
                    <strong>
                      {p.label || (p.isPrimary ? "Primary" : "Property")}
                      {p.isPrimary ? " · Primary" : ""}
                    </strong>
                    <span>{formatAddress(p)}</span>
                  </div>
                ))
              )}
            </div>

            {!showAddProperty ? (
              <button type="button" className="mkt-btn mkt-btn-ghost" onClick={() => setShowAddProperty(true)}>
                Add another property address
              </button>
            ) : (
              <div className="mkt-profile-add-property">
                <div className="mkt-profile-grid">
                  <div className="mkt-field mkt-profile-span-2">
                    <label htmlFor="new-prop-label">Label (optional)</label>
                    <input
                      id="new-prop-label"
                      className="mkt-input"
                      value={newProperty.label}
                      onChange={(e) => setNewProperty((p) => ({ ...p, label: e.target.value }))}
                      placeholder="e.g. Lake house"
                    />
                  </div>
                  <div className="mkt-field mkt-profile-span-2">
                    <label htmlFor="new-prop-street">Street address</label>
                    <input
                      id="new-prop-street"
                      className="mkt-input"
                      value={newProperty.addressLine1}
                      onChange={(e) => setNewProperty((p) => ({ ...p, addressLine1: e.target.value }))}
                    />
                  </div>
                  <div className="mkt-field mkt-profile-span-2">
                    <label htmlFor="new-prop-apt">Apt, suite, unit (optional)</label>
                    <input
                      id="new-prop-apt"
                      className="mkt-input"
                      value={newProperty.addressLine2}
                      onChange={(e) => setNewProperty((p) => ({ ...p, addressLine2: e.target.value }))}
                    />
                  </div>
                  <div className="mkt-field">
                    <label htmlFor="new-prop-city">City</label>
                    <input
                      id="new-prop-city"
                      className="mkt-input"
                      value={newProperty.city}
                      onChange={(e) => setNewProperty((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="mkt-profile-city-row">
                    <div className="mkt-field">
                      <label htmlFor="new-prop-state">State</label>
                      <input
                        id="new-prop-state"
                        className="mkt-input"
                        value={newProperty.state}
                        onChange={(e) => setNewProperty((p) => ({ ...p, state: e.target.value }))}
                        maxLength={2}
                        style={{ textTransform: "uppercase" }}
                      />
                    </div>
                    <div className="mkt-field">
                      <label htmlFor="new-prop-zip">ZIP</label>
                      <input
                        id="new-prop-zip"
                        className="mkt-input"
                        value={newProperty.postalCode}
                        onChange={(e) => setNewProperty((p) => ({ ...p, postalCode: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="mkt-profile-inline-actions">
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-primary"
                    disabled={addingProperty}
                    onClick={() => void addProperty()}
                  >
                    {addingProperty ? "Adding…" : "Save property"}
                  </button>
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-ghost"
                    onClick={() => {
                      setShowAddProperty(false);
                      setErr("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mkt-profile-save-bar">
              <button
                className="mkt-btn mkt-btn-primary"
                type="button"
                onClick={() => void saveProfile()}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </section>

          <section className="mkt-profile-card" id="profile-notifications">
            <div className="mkt-profile-card-head">
              <h2>Notification settings</h2>
              <p>
                Email and SMS preferences sync with the same fields staff see in reporting. June 1 reminders: 30, 7, and
                1 day before your billing date when renewal reminders are on.
              </p>
            </div>
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
          </section>
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
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
