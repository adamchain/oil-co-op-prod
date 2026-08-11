import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type BenefitCard = {
  id: string;
  title: string;
  summary: string;
  detail: ReactNode;
  icon: ReactNode;
};

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <span className="mkt-svc-icon" aria-hidden>
      {children}
    </span>
  );
}

const SAVE_MONEY: BenefitCard[] = [
  {
    id: "heating-oil",
    title: "Discounted Heating Oil",
    summary: "Full-service heating oil at negotiated Co-op rates from trusted local companies.",
    detail: (
      <>
        <p>
          All Co-op heating oil suppliers are <strong>full-service</strong>. Members typically see pricing roughly{" "}
          <strong>40–50¢ below</strong> average state posted prices, with competitive service contracts and access to
          budget billing programs (often arranged before September 1).
        </p>
        <p>
          You become a customer of the company to which you are assigned — the Co-op is here to help if you have service
          or pricing questions.
        </p>
        <p>
          <Link to="/heating-prices">See weekly heating prices →</Link>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="6" y="22" width="28" height="14" rx="2" />
          <path d="M34 28h6l4 4v4h-10" />
          <circle cx="14" cy="38" r="3.5" />
          <circle cx="36" cy="38" r="3.5" />
          <path d="M10 22v-4h12v4" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "propane",
    title: "Discounted Propane",
    summary: "Competitive propane pricing — often with perks like free tank rental for members.",
    detail: (
      <>
        <p>
          Discounted propane pricing; many members receive added benefits such as <strong>free tank rental</strong>. The
          Co-op forwards your information to a participating supplier, who contacts you, performs a safety check, and
          coordinates tank changes as needed.
        </p>
        <p>
          Existing Co-op members can often <strong>add propane without a second membership fee</strong>. Many oil
          suppliers also deliver propane for stacked savings.
        </p>
        <p>
          <Link to="/faq#propane">Propane tank FAQ →</Link>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M18 10h12v6H18z" />
          <path d="M16 16h16v24c0 2-2 4-8 4s-8-2-8-4V16z" />
          <path d="M20 24h8M20 30h8" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "electricity",
    title: "Electricity Supply Options",
    summary: "Compare Co-op electricity rates and shop the broader market.",
    detail: (
      <>
        <p>Click here to see current rates available from our participating electricity supplier.</p>
        <p>
          <a
            href="https://get.thinkenergy.com/oilcoop"
            className="mkt-btn mkt-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Co-op electricity rates
          </a>
        </p>
        <p>We want our members to get the best rate. Click here to see electricity rates outside of the Co-op.</p>
        <p>
          <a
            href="https://www.energizect.com/"
            className="mkt-btn mkt-btn-ghost"
            target="_blank"
            rel="noopener noreferrer"
          >
            Compare rates on Energize CT
          </a>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 38V22l12-14 12 14v16H12z" />
          <path d="M22 38v-10h4v10" />
          <path d="M26 18l-3 6h4l-3 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "insurance",
    title: "Home and Auto Insurance",
    summary: "Discounted auto and homeowners rates through Bearingstar Insurance.",
    detail: (
      <>
        <p>
          We have partnered with Bearingstar Insurance to offer members discounted rates on auto and homeowner&apos;s
          insurance.
        </p>
        <p>
          <a
            className="mkt-btn mkt-btn-primary"
            href={`mailto:hutson@oilco-op.com?subject=${encodeURIComponent("Home and Auto Insurance Quote Request")}&body=${encodeURIComponent(
              "Hello,\n\nI would like to request a free home and auto insurance quote through the Co-op's Bearingstar partnership.\n\nName:\nPhone:\nEmail:\nTown:\n\nThank you!"
            )}`}
          >
            Click here to request a free quote!
          </a>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M24 8l14 6v10c0 9-6 15-14 18-8-3-14-9-14-18V14l14-6z" />
          <path d="M16 28h10l6-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconWrap>
    ),
  },
];

const GO_GREEN: BenefitCard[] = [
  {
    id: "solar",
    title: "Solar Consultations",
    summary: "Members who enroll through the Co-op can earn $500 when solar installation is complete.",
    detail: (
      <>
        <p>
          Members who enroll through the Co-op receive a <strong>$500</strong> check upon completion of the solar panel
          installation.
        </p>
        <p>
          <a
            className="mkt-btn mkt-btn-primary"
            href={`mailto:hutson@oilco-op.com?subject=${encodeURIComponent("Solar Consultation Request")}&body=${encodeURIComponent(
              "Hello,\n\nI would like to request a free solar consultation through the Co-op.\n\nName:\nPhone:\nEmail:\nTown:\n\nThank you!"
            )}`}
          >
            Click here to request a free consultation.
          </a>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="34" cy="12" r="5" />
          <path d="M10 38V24l12-10 12 10v14H10z" />
          <path d="M16 28h6M16 32h8" />
          <path d="M34 6v2M40 12h2M38.5 7.5l1.5 1.5" strokeLinecap="round" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "bioheat",
    title: "Bioheat® (Cleaner Heating Oil)",
    summary: "B20 bioheat blends biodiesel with heating oil — cleaner burn in existing equipment.",
    detail: (
      <>
        <p>
          <strong>B20</strong> is 80% low-sulfur No. 2 oil and 20% biodiesel — usable in existing oil equipment.
          Biodiesel in the blend is sourced to meet ASTM standards.
        </p>
        <p>Available in many Connecticut towns.</p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M24 8c8 10 12 16 12 22a12 12 0 1 1-24 0c0-6 4-12 12-22z" />
          <path d="M24 28c-2-4-2-8 0-12 2 4 2 8 0 12z" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "compost",
    title: "Composting Discounts",
    summary: "Member discounts on organics and composting programs, including Blue Earth Compost.",
    detail: (
      <>
        <p>
          The Co-op highlights additional member programs — including organics and compost offers — as seasonal
          benefits. Ask the office what&apos;s currently available in your area.
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M14 38h20l3-18H11l3 18z" />
          <path d="M18 20c2-6 5-10 6-12 1 2 4 6 6 12" />
          <path d="M24 14v6" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "audits",
    title: "Home Energy Audits",
    summary: "Discounted home energy audits through New England Smart Energy (NESE).",
    detail: (
      <>
        <p>
          Partner <strong>New England Smart Energy (NESE)</strong> offers audits across Connecticut with a modest
          copay (often around <strong>$50</strong>), including in-home measures and access to rebates on follow-up
          improvements.
        </p>
        <p>
          Audits are an invaluable way to reduce heat loss for your home and to access rebates on follow-up
          improvements.
        </p>
        <p>
          <a
            className="mkt-btn mkt-btn-primary"
            href={`mailto:hutson@oilco-op.com?subject=${encodeURIComponent("Home Energy Audit Request")}&body=${encodeURIComponent(
              "Hello,\n\nI would like to schedule a home energy audit through the Co-op.\n\nName:\nPhone:\nEmail:\nTown:\n\nThank you!"
            )}`}
          >
            Click here to schedule an audit.
          </a>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M10 36V22l12-12 12 12v14H10z" />
          <circle cx="32" cy="32" r="8" />
          <path d="M37 37l5 5" strokeLinecap="round" />
        </svg>
      </IconWrap>
    ),
  },
];

const WHY_MEMBER: BenefitCard[] = [
  {
    id: "advocacy",
    title: "Consumer Advocacy",
    summary: "Someone in your corner if you have a service, pricing, or billing question with your supplier.",
    detail: (
      <>
        <p>
          Our large membership lets Citizen&apos;s Oil Co-op negotiate better contracts — and advocate for your needs
          with participating companies. If you have a problem, we&apos;re here to help.
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M24 10l12 5v8c0 8-5 13-12 16-7-3-12-8-12-16v-8l12-5z" />
          <path d="M16 24c2 2 5 4 8 4s6-2 8-4" strokeLinecap="round" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "senior-discounts",
    title: "Discounts for Seniors, Veterans & First Responders",
    summary: "Reduced annual dues for seniors, with additional savings options for those who serve.",
    detail: (
      <>
        <p>
          Membership is <strong>$35 per year</strong>, or <strong>$25 for seniors</strong>, plus a one-time $10
          application fee for new accounts. Ask the office about current offers for veterans and first responders.
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="24" cy="22" r="10" />
          <path d="M24 14l2.2 4.5 5 .7-3.6 3.5.9 5L24 25.5 19.5 27.7l.9-5-3.6-3.5 5-.7L24 14z" />
          <path d="M16 34h16v4H16z" />
        </svg>
      </IconWrap>
    ),
  },
  {
    id: "partners",
    title: "Local Partner Network",
    summary: "Trusted full-service heating companies across CT, RI, and select towns in NY and MA.",
    detail: (
      <>
        <p>
          We recommend the best participating company based on your location, pricing, and service preferences.
        </p>
        <p>They&apos;ll call you and set up your account at Co-op pricing.</p>
        <p>
          <Link to="/#towns">See coverage area →</Link>
        </p>
      </>
    ),
    icon: (
      <IconWrap>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M14 34c2-10 6-18 10-22 4 4 8 12 10 22" />
          <path d="M18 28h12" />
          <circle cx="24" cy="18" r="3" />
          <path d="M24 21v5" />
        </svg>
      </IconWrap>
    ),
  },
];

function BenefitCardItem({
  card,
  open,
  onToggle,
}: {
  card: BenefitCard;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`mkt-svc-card${open ? " is-open" : ""}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      {card.icon}
      <span className="mkt-svc-card-title">{card.title}</span>
      <span className="mkt-svc-card-summary">{card.summary}</span>
      <span className="mkt-svc-card-more">
        {open ? "Show less" : "Learn more"} <span aria-hidden>{open ? "↑" : "→"}</span>
      </span>
    </button>
  );
}

function CategoryBlock({
  id,
  tone,
  icon,
  title,
  blurb,
  cards,
}: {
  id: string;
  tone: "green" | "navy";
  icon: ReactNode;
  title: string;
  blurb: string;
  cards: BenefitCard[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openCard = cards.find((c) => c.id === openId) ?? null;

  return (
    <section className={`mkt-svc-category mkt-svc-category--${tone}`} id={id}>
      <div className="mkt-container mkt-svc-category-inner">
        <div className="mkt-svc-category-label">
          <span className="mkt-svc-category-badge" aria-hidden>
            {icon}
          </span>
          <h2>{title}</h2>
          <p>{blurb}</p>
        </div>
        <div className="mkt-svc-category-main">
          <div className={`mkt-svc-grid ${cards.length === 3 ? "mkt-svc-grid--3" : ""}`}>
            {cards.map((card) => (
              <BenefitCardItem
                key={card.id}
                card={card}
                open={openId === card.id}
                onToggle={() => setOpenId((prev) => (prev === card.id ? null : card.id))}
              />
            ))}
          </div>
          {openCard && (
            <div className="mkt-svc-detail-panel mkt-prose" role="region" aria-label={`${openCard.title} details`}>
              <h3>{openCard.title}</h3>
              {openCard.detail}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReferralCallout() {
  const [open, setOpen] = useState(false);
  const [referrerName, setReferrerName] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [friendPhone, setFriendPhone] = useState("");

  return (
    <section className="mkt-svc-referral" id="refer-neighbor" aria-label="Referral program">
      <div className="mkt-container mkt-svc-referral-inner">
        <p className="mkt-svc-referral-copy">
          <strong>Already a member?</strong> Don&apos;t forget about our referral program. Have your neighbor sign up
          and we&apos;ll waive your membership next year!{" "}
          <button
            type="button"
            className="mkt-svc-referral-toggle"
            aria-expanded={open}
            aria-controls="svc-referral-form"
            onClick={() => setOpen((prev) => !prev)}
          >
            Click here if you would like us to reach out to someone you know.
          </button>
        </p>
        {open && (
          <form
            id="svc-referral-form"
            className="mkt-svc-referral-form"
            action="mailto:hutson@oilco-op.com"
            method="post"
            encType="text/plain"
          >
            <input
              type="text"
              name="your_name"
              placeholder="Your name"
              value={referrerName}
              onChange={(e) => setReferrerName(e.target.value)}
              required
              autoComplete="name"
            />
            <input
              type="email"
              name="your_email"
              placeholder="Your email"
              value={referrerEmail}
              onChange={(e) => setReferrerEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="text"
              name="friend_name"
              placeholder="Friend's name"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              required
            />
            <input
              type="email"
              name="friend_email"
              placeholder="Friend's email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              name="friend_phone"
              placeholder="Friend's phone (optional)"
              value={friendPhone}
              onChange={(e) => setFriendPhone(e.target.value)}
            />
            <button type="submit" className="mkt-btn mkt-btn-primary">
              Send referral
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/** Services / member benefits page — Save Money, Go Green, Why become a member. */
export default function ServicesPage() {
  return (
    <div className="mkt-services-page">
      <section className="mkt-svc-hero">
        <img src="/site/family.jpg" alt="" className="mkt-svc-hero-img" />
        <div className="mkt-svc-hero-scrim" aria-hidden />
        <div className="mkt-container mkt-svc-hero-copy">
          <h1>Everything your membership includes.</h1>
          <p>More than discounted fuel. Your membership comes with valuable benefits all year long.</p>
        </div>
      </section>

      <ReferralCallout />

      <CategoryBlock
        id="save-money"
        tone="green"
        title="Save money"
        blurb="Lower your home energy costs with exclusive member benefits."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v10M9.5 9.5c.5-1 1.5-1.5 2.5-1.5s2 .6 2 1.75-1 1.75-2.5 2.25-2.5.75-2.5 2.25 1 1.75 2.5 1.75 2-.5 2.5-1.5" strokeLinecap="round" />
          </svg>
        }
        cards={SAVE_MONEY}
      />

      <CategoryBlock
        id="go-green"
        tone="green"
        title="Go green"
        blurb="Smart energy solutions that help your wallet and the environment."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 19c8-2 12-8 14-14-6 2-11 6-14 14z" />
            <path d="M5 19c2-4 6-7 11-8" strokeLinecap="round" />
          </svg>
        }
        cards={GO_GREEN}
      />

      <CategoryBlock
        id="why-member"
        tone="navy"
        title="Why become a member?"
        blurb="We do the work so you can save with confidence."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="3" />
            <circle cx="16" cy="10" r="2.5" />
            <path d="M3 19c1-3 3.5-5 6-5s5 2 6 5" />
            <path d="M13 19c.5-2 2-3.5 4.5-3.5 1.2 0 2.3.4 3.5 1.5" />
          </svg>
        }
        cards={WHY_MEMBER}
      />

      <section className="mkt-svc-cta">
        <div className="mkt-container mkt-svc-cta-inner">
          <p>Join over 5,000 Connecticut homeowners and start saving today.</p>
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Join Now
          </Link>
        </div>
      </section>
    </div>
  );
}
