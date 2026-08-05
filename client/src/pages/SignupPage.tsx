import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";
import { PENDING_PROPERTY_KEY, type PendingProperty } from "../utils/pendingProperty";

type MembershipPlan = "lowVolume" | "senior" | "standard";
type YesNo = "yes" | "no";
type PhoneType = "" | "CELL" | "HOME" | "BUSINESS";

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District Of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

const MEMBERSHIP_PLANS: { id: MembershipPlan; label: string; price: string }[] = [
  { id: "lowVolume", label: "Low Volume Oil Co-op Membership", price: "$20.00" },
  { id: "senior", label: "Senior (55+) Oil Co-op Membership", price: "$25.00" },
  { id: "standard", label: "Standard Oil Co-op Membership", price: "$35.00" },
];

function YesNoField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  return (
    <fieldset className="mkt-field mkt-yesno">
      <legend>{label}</legend>
      <div className="mkt-yesno-options">
        <label>
          <input type="radio" name={name} checked={value === "yes"} onChange={() => onChange("yes")} /> Yes
        </label>
        <label>
          <input type="radio" name={name} checked={value === "no"} onChange={() => onChange("no")} /> No
        </label>
      </div>
    </fieldset>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mkt-signup-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type AccountMatchHint = {
  matchedBy: "email" | "phone" | "address";
  maskedName: string;
  city: string;
  state: string;
  maskedEmail: string;
  maskedPhone: string;
  existingAddress: string;
};

type MatchModalStep = "match" | "signin" | null;

export default function SignupPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountMatch, setAccountMatch] = useState<AccountMatchHint | null>(null);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const [matchModal, setMatchModal] = useState<MatchModalStep>(null);
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimLabel, setClaimLabel] = useState("Additional property");
  const [claimLoading, setClaimLoading] = useState(false);
  const [lookupKey, setLookupKey] = useState("");
  const [form, setForm] = useState({
    membershipPlan: "standard" as MembershipPlan,
    firstName: "",
    middleName: "",
    lastName: "",
    addressLine1: "",
    city: "",
    state: "CT",
    postalCode: "",
    sameMailingAddress: "yes" as YesNo,
    mailingAddressLine1: "",
    mailingCity: "",
    mailingState: "CT",
    mailingPostalCode: "",
    email: "",
    password: "",
    phone: "",
    primaryPhoneType: "CELL" as PhoneType,
    secondaryPhone: "",
    secondaryPhoneType: "" as PhoneType,
    interestedInOil: "no" as YesNo,
    currentOilProvider: "",
    stayWithOilProvider: "no" as YesNo,
    interestedInPropane: "no" as YesNo,
    currentPropaneProvider: "",
    stayWithPropaneProvider: "no" as YesNo,
    interestedInSolar: "no" as YesNo,
    interestedInEnergyAudit: "no" as YesNo,
    interestedInInsurance: "no" as YesNo,
    whoReferredYou: "",
    affiliatedOrganization: "no" as YesNo,
    organization: "",
    paymentMethod: "card" as "card" | "check",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  });

  const planPrice = useMemo(
    () => MEMBERSHIP_PLANS.find((p) => p.id === form.membershipPlan)?.price ?? "$35.00",
    [form.membershipPlan]
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function checkExistingAccount(
    email = form.email,
    phone = form.phone,
    phone2 = form.secondaryPhone,
    address = {
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
    }
  ) {
    const key = [
      email.trim().toLowerCase(),
      phone.trim(),
      phone2.trim(),
      address.addressLine1.trim().toLowerCase(),
      address.city.trim().toLowerCase(),
      address.state.trim().toUpperCase(),
      address.postalCode.trim(),
    ].join("|");
    if (!email.trim() && !phone.trim() && !phone2.trim() && !address.addressLine1.trim()) return;
    if (key === lookupKey && (accountMatch || matchDismissed || matchModal)) return;
    try {
      const res = await api<{ match: boolean; hint?: AccountMatchHint }>("/api/auth/lookup-account", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
          phone2: phone2.trim(),
          addressLine1: address.addressLine1.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
        }),
      });
      setLookupKey(key);
      if (res.match && res.hint) {
        setAccountMatch(res.hint);
        setMatchDismissed(false);
        setMatchModal("match");
        if (res.hint.matchedBy === "email" && email.trim()) {
          setClaimEmail(email.trim().toLowerCase());
        }
      } else {
        setAccountMatch(null);
        setMatchDismissed(false);
        if (matchModal !== "signin") setMatchModal(null);
      }
    } catch {
      /* lookup is best-effort; registration still validates duplicates */
    }
  }

  function pendingPropertyFromForm(): PendingProperty {
    return {
      label: claimLabel.trim() || "Additional property",
      addressLine1: form.addressLine1.trim(),
      addressLine2: "",
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
    };
  }

  async function onSignInAddProperty() {
    setErr("");
    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.postalCode.trim()) {
      setErr("Enter the new property address in the Home address fields, then continue.");
      return;
    }
    if (!claimEmail.trim() || !claimPassword) {
      setErr("Enter your existing account email and password to continue.");
      return;
    }
    setClaimLoading(true);
    try {
      const res = await api<{
        token: string;
        member: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          memberNumber?: string;
          role?: string;
        };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: claimEmail.trim().toLowerCase(),
          password: claimPassword,
        }),
      });
      sessionStorage.setItem(PENDING_PROPERTY_KEY, JSON.stringify(pendingPropertyFromForm()));
      setSession(res.token, res.member);
      setMatchModal(null);
      nav("/account");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not sign in");
    } finally {
      setClaimLoading(false);
    }
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (matchModal === "signin" || matchModal === "match") {
      setErr(
        matchModal === "signin"
          ? "Sign in to your existing account in the dialog to add this address, or close it to continue as a new member."
          : "Please confirm whether the existing account we found is yours before continuing."
      );
      return;
    }
    if (accountMatch && !matchDismissed) {
      setMatchModal("match");
      setErr("Please confirm whether the existing account we found is yours before continuing.");
      return;
    }

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
        referrerToken: form.whoReferredYou,
        membershipPlan: form.membershipPlan,
        middleName: form.middleName,
        sameMailingAddress: form.sameMailingAddress === "yes",
        mailingAddressLine1: form.mailingAddressLine1,
        mailingCity: form.mailingCity,
        mailingState: form.mailingState,
        mailingPostalCode: form.mailingPostalCode,
        primaryPhoneType: form.primaryPhoneType,
        secondaryPhone: form.secondaryPhone,
        secondaryPhoneType: form.secondaryPhoneType,
        interestedInOil: form.interestedInOil === "yes",
        currentOilProvider: form.currentOilProvider,
        stayWithOilProvider: form.stayWithOilProvider === "yes",
        interestedInPropane: form.interestedInPropane === "yes",
        currentPropaneProvider: form.currentPropaneProvider,
        stayWithPropaneProvider: form.stayWithPropaneProvider === "yes",
        interestedInSolar: form.interestedInSolar === "yes",
        interestedInEnergyAudit: form.interestedInEnergyAudit === "yes",
        interestedInInsurance: form.interestedInInsurance === "yes",
        whoReferredYou: form.whoReferredYou,
        affiliatedOrganization: form.affiliatedOrganization === "yes",
        organization: form.organization,
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
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : "Signup failed";
      if (/email already registered/i.test(message)) {
        await checkExistingAccount(form.email, form.phone);
        setErr("An account with this email already exists. Is this you? You can add a new property address to that profile.");
      } else {
        setErr(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mkt-panel mkt-signup-page">
      <h1 className="mkt-page-title">Join Citizen&apos;s Oil Co-op</h1>
      <p className="mkt-lead">Fill out the form below to join!</p>

      <div className="mkt-card-form">
        <form onSubmit={onSubmit}>
          <Section title="Membership">
            <div className="mkt-field">
              <label htmlFor="membershipPlan">Membership Plans *</label>
              <select
                id="membershipPlan"
                required
                value={form.membershipPlan}
                onChange={(e) => set("membershipPlan", e.target.value as MembershipPlan)}
              >
                {MEMBERSHIP_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.price}
                  </option>
                ))}
              </select>
              <p className="mkt-field-hint">* Senior Membership is for members ages 55 &amp; older.</p>
              <p className="mkt-field-hint">
                * Low Volume Membership requires an annual volume of under 300 gallons annually.
              </p>
            </div>
            <div className="mkt-fee-row">
              <span>Processing Fee:</span>
              <strong>$10.00</strong>
            </div>
            <div className="mkt-fee-row">
              <span>Annual dues (selected plan):</span>
              <strong>{planPrice}</strong>
            </div>
          </Section>

          <Section title="Contact">
            <div className="mkt-row3">
              <div className="mkt-field">
                <label htmlFor="firstName">First name *</label>
                <input
                  id="firstName"
                  required
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="middleName">MI</label>
                <input
                  id="middleName"
                  placeholder="MI"
                  value={form.middleName}
                  onChange={(e) => set("middleName", e.target.value)}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="lastName">Last name *</label>
                <input
                  id="lastName"
                  required
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </div>
            </div>

            <div className="mkt-field">
              <label htmlFor="addressLine1">Home address *</label>
              <input
                id="addressLine1"
                required
                placeholder="Address Line 1"
                value={form.addressLine1}
                onChange={(e) => {
                  set("addressLine1", e.target.value);
                  setLookupKey("");
                }}
                onBlur={() => void checkExistingAccount()}
              />
            </div>
            <div className="mkt-row3">
              <div className="mkt-field">
                <label htmlFor="city">City *</label>
                <input
                  id="city"
                  required
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => {
                    set("city", e.target.value);
                    setLookupKey("");
                  }}
                  onBlur={() => void checkExistingAccount()}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="state">State *</label>
                <select
                  id="state"
                  required
                  value={form.state}
                  onChange={(e) => {
                    set("state", e.target.value);
                    setLookupKey("");
                  }}
                  onBlur={() => void checkExistingAccount()}
                >
                  <option value="">State</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mkt-field">
                <label htmlFor="postalCode">Zip *</label>
                <input
                  id="postalCode"
                  required
                  placeholder="Zip"
                  value={form.postalCode}
                  onChange={(e) => {
                    set("postalCode", e.target.value);
                    setLookupKey("");
                  }}
                  onBlur={() => void checkExistingAccount()}
                />
              </div>
            </div>

            <YesNoField
              label="Mailing Address Same as Home"
              name="sameMailingAddress"
              value={form.sameMailingAddress}
              onChange={(v) => set("sameMailingAddress", v)}
            />

            {form.sameMailingAddress === "no" && (
              <>
                <div className="mkt-field">
                  <label htmlFor="mailingAddressLine1">Mailing address</label>
                  <input
                    id="mailingAddressLine1"
                    placeholder="Address Line 1"
                    value={form.mailingAddressLine1}
                    onChange={(e) => set("mailingAddressLine1", e.target.value)}
                  />
                </div>
                <div className="mkt-row3">
                  <div className="mkt-field">
                    <label htmlFor="mailingCity">City</label>
                    <input
                      id="mailingCity"
                      placeholder="City"
                      value={form.mailingCity}
                      onChange={(e) => set("mailingCity", e.target.value)}
                    />
                  </div>
                  <div className="mkt-field">
                    <label htmlFor="mailingState">State</label>
                    <select
                      id="mailingState"
                      value={form.mailingState}
                      onChange={(e) => set("mailingState", e.target.value)}
                    >
                      <option value="">State</option>
                      {US_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mkt-field">
                    <label htmlFor="mailingPostalCode">Zip</label>
                    <input
                      id="mailingPostalCode"
                      placeholder="Zip"
                      value={form.mailingPostalCode}
                      onChange={(e) => set("mailingPostalCode", e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="mkt-field">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => {
                  set("email", e.target.value);
                  setLookupKey("");
                }}
                onBlur={() => void checkExistingAccount()}
              />
            </div>
            <div className="mkt-field">
              <label htmlFor="password">Account password * (min 8 characters)</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </div>

            <div className="mkt-row2">
              <div className="mkt-field">
                <label htmlFor="phone">Primary Phone *</label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => {
                    set("phone", e.target.value);
                    setLookupKey("");
                  }}
                  onBlur={() => void checkExistingAccount()}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="primaryPhoneType">Primary Phone Type</label>
                <select
                  id="primaryPhoneType"
                  value={form.primaryPhoneType}
                  onChange={(e) => set("primaryPhoneType", e.target.value as PhoneType)}
                >
                  <option value="CELL">CELL</option>
                  <option value="HOME">HOME</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </div>
            </div>
            <div className="mkt-row2">
              <div className="mkt-field">
                <label htmlFor="secondaryPhone">Secondary Phone</label>
                <input
                  id="secondaryPhone"
                  type="tel"
                  value={form.secondaryPhone}
                  onChange={(e) => {
                    set("secondaryPhone", e.target.value);
                    setLookupKey("");
                  }}
                  onBlur={() => void checkExistingAccount()}
                />
              </div>
              <div className="mkt-field">
                <label htmlFor="secondaryPhoneType">Secondary Phone Type</label>
                <select
                  id="secondaryPhoneType"
                  value={form.secondaryPhoneType}
                  onChange={(e) => set("secondaryPhoneType", e.target.value as PhoneType)}
                >
                  <option value="">—</option>
                  <option value="CELL">CELL</option>
                  <option value="HOME">HOME</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Interests">
            <YesNoField
              label="I'm interested in discounted oil deliveries"
              name="interestedInOil"
              value={form.interestedInOil}
              onChange={(v) => set("interestedInOil", v)}
            />
            <div className="mkt-field">
              <label htmlFor="currentOilProvider">Current Oil Provider (optional)</label>
              <input
                id="currentOilProvider"
                placeholder="Optional"
                value={form.currentOilProvider}
                onChange={(e) => set("currentOilProvider", e.target.value)}
              />
            </div>
            <YesNoField
              label="I would like to stay with my current oil provider if they participate in the Co-op"
              name="stayWithOilProvider"
              value={form.stayWithOilProvider}
              onChange={(v) => set("stayWithOilProvider", v)}
            />

            <YesNoField
              label="I'm interested in discounted propane deliveries"
              name="interestedInPropane"
              value={form.interestedInPropane}
              onChange={(v) => set("interestedInPropane", v)}
            />
            <div className="mkt-field">
              <label htmlFor="currentPropaneProvider">Current Propane Provider (optional)</label>
              <input
                id="currentPropaneProvider"
                placeholder="Optional"
                value={form.currentPropaneProvider}
                onChange={(e) => set("currentPropaneProvider", e.target.value)}
              />
            </div>
            <YesNoField
              label="I would like to stay with my current propane provider if they participate in the Co-op"
              name="stayWithPropaneProvider"
              value={form.stayWithPropaneProvider}
              onChange={(v) => set("stayWithPropaneProvider", v)}
            />

            <YesNoField
              label="I'm interested in FREE solar consultation for my home"
              name="interestedInSolar"
              value={form.interestedInSolar}
              onChange={(v) => set("interestedInSolar", v)}
            />
            <YesNoField
              label="I'm interested in home energy audit"
              name="interestedInEnergyAudit"
              value={form.interestedInEnergyAudit}
              onChange={(v) => set("interestedInEnergyAudit", v)}
            />
            <YesNoField
              label="I would like FREE home or auto insurance quote"
              name="interestedInInsurance"
              value={form.interestedInInsurance}
              onChange={(v) => set("interestedInInsurance", v)}
            />
          </Section>

          <Section title="Referrals & organizations">
            <div className="mkt-field">
              <label htmlFor="whoReferredYou">Did a member or organization refer you?</label>
              <input
                id="whoReferredYou"
                value={form.whoReferredYou}
                onChange={(e) => set("whoReferredYou", e.target.value)}
              />
              <p className="mkt-field-hint">
                Please enter the Oil Co-op member&apos;s full name so we can make sure that they get the credit! Thanks!
              </p>
            </div>
            <YesNoField
              label="Are you affiliated with any organizations that might want to know about the Co-op?"
              name="affiliatedOrganization"
              value={form.affiliatedOrganization}
              onChange={(v) => set("affiliatedOrganization", v)}
            />
            {form.affiliatedOrganization === "yes" && (
              <div className="mkt-field">
                <label htmlFor="organization">Organization(s)</label>
                <input
                  id="organization"
                  value={form.organization}
                  onChange={(e) => set("organization", e.target.value)}
                />
              </div>
            )}
          </Section>

          <Section title="Payment">
            <div className="mkt-field">
              <label htmlFor="paymentMethod">Payment method</label>
              <select
                id="paymentMethod"
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value as "card" | "check")}
              >
                <option value="card">Credit/Debit Card (auto-renew enabled)</option>
                <option value="check">Check (manual renewal each year)</option>
              </select>
            </div>

            {form.paymentMethod === "card" && (
              <div className="mkt-card-section">
                <h3>Payment Information</h3>
                <p>
                  Your card will be charged the $10.00 processing fee now. Annual membership dues ({planPrice}) are
                  billed each June 1.
                </p>
                <div className="mkt-field">
                  <label htmlFor="cardNumber">Card number</label>
                  <input
                    id="cardNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={form.cardNumber}
                    onChange={(e) => set("cardNumber", formatCardNumber(e.target.value))}
                    maxLength={19}
                    required={form.paymentMethod === "card"}
                    style={{ fontFamily: "monospace" }}
                  />
                </div>
                <div className="mkt-row2">
                  <div className="mkt-field">
                    <label htmlFor="cardExpiry">Expiration (MM/YY)</label>
                    <input
                      id="cardExpiry"
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={form.cardExpiry}
                      onChange={(e) => set("cardExpiry", formatExpiry(e.target.value))}
                      maxLength={5}
                      required={form.paymentMethod === "card"}
                      style={{ fontFamily: "monospace" }}
                    />
                  </div>
                  <div className="mkt-field">
                    <label htmlFor="cardCvv">CVV</label>
                    <input
                      id="cardCvv"
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      value={form.cardCvv}
                      onChange={(e) => set("cardCvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      required={form.paymentMethod === "card"}
                      style={{ fontFamily: "monospace", maxWidth: "100px" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {form.paymentMethod === "check" && (
              <div className="mkt-check-note">
                <p>
                  <strong>Check payment:</strong> Your account will be created but marked as pending. Mail your
                  processing fee and membership dues check to the office. Annual renewals will also require mailing a
                  check each year.
                </p>
              </div>
            )}
          </Section>

          {err && <p className="mkt-error">{err}</p>}
          <button type="submit" className="mkt-btn mkt-btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Processing…" : form.paymentMethod === "card" ? "Pay & Join Now" : "Join Now"}
          </button>
        </form>
      </div>

      <p className="mkt-lead" style={{ marginTop: "1.5rem", marginBottom: 0 }}>
        Already a member? <Link to="/login">Sign in</Link>
      </p>

      {matchModal && accountMatch && (
        <div
          className="mkt-modal-backdrop"
          role="presentation"
          onClick={() => {
            /* require explicit close */
          }}
        >
          <div
            className="mkt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mkt-match-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {matchModal === "match" ? (
              <>
                <h2 id="mkt-match-modal-title">You may already have an account</h2>
                <p>
                  We found a member profile for <strong>{accountMatch.maskedName}</strong>
                  {accountMatch.city || accountMatch.state
                    ? ` in ${[accountMatch.city, accountMatch.state].filter(Boolean).join(", ")}`
                    : ""}
                  {accountMatch.matchedBy === "email" && accountMatch.maskedEmail
                    ? ` (email ${accountMatch.maskedEmail})`
                    : ""}
                  {accountMatch.matchedBy === "phone" && accountMatch.maskedPhone
                    ? ` (phone ${accountMatch.maskedPhone})`
                    : ""}
                  {accountMatch.matchedBy === "address" ? " based on this address" : ""}
                  . Is this you?
                </p>
                {accountMatch.existingAddress && (
                  <p className="mkt-existing-account-address">On file: {accountMatch.existingAddress}</p>
                )}
                <div className="mkt-existing-account-actions">
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-primary"
                    onClick={() => {
                      setMatchModal("signin");
                      setErr("");
                      if (accountMatch.matchedBy === "email" && form.email.trim()) {
                        setClaimEmail(form.email.trim().toLowerCase());
                      }
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-ghost"
                    onClick={() => {
                      if (accountMatch.matchedBy === "email") {
                        setErr(
                          "This email is already registered. Sign in to add a property, or use a different email to create a new account."
                        );
                        setMatchModal(null);
                        return;
                      }
                      setMatchDismissed(true);
                      setAccountMatch(null);
                      setMatchModal(null);
                      setErr("");
                    }}
                  >
                    No, continue as new member
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="mkt-match-modal-title">Sign in to add this address</h2>
                <div className="mkt-modal-confirm">
                  <p className="mkt-modal-confirm-label">You are adding this address to your membership:</p>
                  <p className="mkt-modal-confirm-address">
                    {[form.addressLine1, form.city, form.state, form.postalCode].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <p>
                  Sign in with your existing account. After you sign in, this address will be ready on your profile —
                  just hit Save.
                </p>
                <div className="mkt-field">
                  <label htmlFor="claimEmail">Account email</label>
                  <input
                    id="claimEmail"
                    type="email"
                    required
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="mkt-field">
                  <label htmlFor="claimPassword">Account password</label>
                  <input
                    id="claimPassword"
                    type="password"
                    required
                    value={claimPassword}
                    onChange={(e) => setClaimPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="mkt-field">
                  <label htmlFor="claimLabel">Label for this property (optional)</label>
                  <input
                    id="claimLabel"
                    value={claimLabel}
                    onChange={(e) => setClaimLabel(e.target.value)}
                    placeholder="e.g. Lake house, Rental"
                  />
                </div>
                {err && <p className="mkt-error">{err}</p>}
                <div className="mkt-existing-account-actions">
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-primary"
                    disabled={claimLoading}
                    onClick={() => void onSignInAddProperty()}
                  >
                    {claimLoading ? "Signing in…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-ghost"
                    onClick={() => {
                      setMatchModal("match");
                      setClaimPassword("");
                      setErr("");
                    }}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
