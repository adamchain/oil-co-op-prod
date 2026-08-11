import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useSiteText } from "./content/SiteContentContext";
import type { ContentGroup } from "./content/types";

type BenefitCard = {
  id: string;
  titleKey: string;
  summaryKey: string;
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
    titleKey: "services.heatingOilTitle",
    summaryKey: "services.heatingOilSummary",
    detail: (
      <>
        <p>
          <UseText k="services.heatingOilDetail1" />
        </p>
        <p>
          <UseText k="services.heatingOilDetail2" />
        </p>
        <p>
          <Link to="/heating-prices">
            <UseText k="services.heatingOilLink" />
          </Link>
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
    titleKey: "services.propaneTitle",
    summaryKey: "services.propaneSummary",
    detail: (
      <>
        <p>
          <UseText k="services.propaneDetail1" />
        </p>
        <p>
          <UseText k="services.propaneDetail2" />
        </p>
        <p>
          <Link to="/faq#propane">
            <UseText k="services.propaneLink" />
          </Link>
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
    titleKey: "services.electricityTitle",
    summaryKey: "services.electricitySummary",
    detail: (
      <>
        <p>
          <UseText k="services.electricityDetail1" />
        </p>
        <p>
          <a
            href="https://get.thinkenergy.com/oilcoop"
            className="mkt-btn mkt-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <UseText k="services.electricityBtn1" />
          </a>
        </p>
        <p>
          <UseText k="services.electricityDetail2" />
        </p>
        <p>
          <a
            href="https://www.energizect.com/"
            className="mkt-btn mkt-btn-ghost"
            target="_blank"
            rel="noopener noreferrer"
          >
            <UseText k="services.electricityBtn2" />
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
    titleKey: "services.insuranceTitle",
    summaryKey: "services.insuranceSummary",
    detail: (
      <>
        <p>
          <UseText k="services.insuranceDetail1" />
        </p>
        <p>
          <a
            className="mkt-btn mkt-btn-primary"
            href={`mailto:hutson@oilco-op.com?subject=${encodeURIComponent("Home and Auto Insurance Quote Request")}&body=${encodeURIComponent(
              "Hello,\n\nI would like to request a free home and auto insurance quote through the Co-op's Bearingstar partnership.\n\nName:\nPhone:\nEmail:\nTown:\n\nThank you!"
            )}`}
          >
            <UseText k="services.insuranceBtn" />
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
    titleKey: "services.solarTitle",
    summaryKey: "services.solarSummary",
    detail: (
      <>
        <p>
          <UseText k="services.solarDetail1" />
        </p>
        <p>
          <a
            className="mkt-btn mkt-btn-primary"
            href={`mailto:hutson@oilco-op.com?subject=${encodeURIComponent("Solar Consultation Request")}&body=${encodeURIComponent(
              "Hello,\n\nI would like to request a free solar consultation through the Co-op.\n\nName:\nPhone:\nEmail:\nTown:\n\nThank you!"
            )}`}
          >
            <UseText k="services.solarBtn" />
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
    titleKey: "services.bioheatTitle",
    summaryKey: "services.bioheatSummary",
    detail: (
      <>
        <p>
          <UseText k="services.bioheatDetail1" />
        </p>
        <p>
          <UseText k="services.bioheatDetail2" />
        </p>
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
    titleKey: "services.compostTitle",
    summaryKey: "services.compostSummary",
    detail: (
      <>
        <p>
          <UseText k="services.compostDetail1" />
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
    titleKey: "services.auditsTitle",
    summaryKey: "services.auditsSummary",
    detail: (
      <>
        <p>
          <UseText k="services.auditsDetail1" />
        </p>
        <p>
          <UseText k="services.auditsDetail2" />
        </p>
        <p>
          <a
            className="mkt-btn mkt-btn-primary"
            href={`mailto:hutson@oilco-op.com?subject=${encodeURIComponent("Home Energy Audit Request")}&body=${encodeURIComponent(
              "Hello,\n\nI would like to schedule a home energy audit through the Co-op.\n\nName:\nPhone:\nEmail:\nTown:\n\nThank you!"
            )}`}
          >
            <UseText k="services.auditsBtn" />
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
    titleKey: "services.advocacyTitle",
    summaryKey: "services.advocacySummary",
    detail: (
      <>
        <p>
          <UseText k="services.advocacyDetail1" />
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
    titleKey: "services.seniorTitle",
    summaryKey: "services.seniorSummary",
    detail: (
      <>
        <p>
          <UseText k="services.seniorDetail1" />
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
    titleKey: "services.partnersTitle",
    summaryKey: "services.partnersSummary",
    detail: (
      <>
        <p>
          <UseText k="services.partnersDetail1" />
        </p>
        <p>
          <UseText k="services.partnersDetail2" />
        </p>
        <p>
          <Link to="/#towns">
            <UseText k="services.partnersLink" />
          </Link>
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

/** Renders an editable string via the site content registry. */
function UseText({ k }: { k: string }) {
  const t = useSiteText();
  return <>{t(k)}</>;
}

export const SERVICES_CONTENT: ContentGroup = {
  page: "services",
  title: "Services",
  fields: [
    { key: "services.heroTitle", label: "Hero title", value: "Everything your membership includes." },
    {
      key: "services.heroBlurb",
      label: "Hero blurb",
      value: "More than discounted fuel. Your membership comes with valuable benefits all year long.",
      multiline: true,
    },

    { key: "services.referralIntro", label: "Referral intro", value: "Already a member?", },
    {
      key: "services.referralCopy",
      label: "Referral copy",
      value: "Don't forget about our referral program. Have your neighbor sign up and we'll waive your membership next year!",
      multiline: true,
    },
    {
      key: "services.referralToggle",
      label: "Referral toggle",
      value: "Click here if you would like us to reach out to someone you know.",
      multiline: true,
    },
    { key: "services.referralSubmit", label: "Referral submit button", value: "Send referral" },

    { key: "services.saveMoneyTitle", label: "Save money title", value: "Save money" },
    {
      key: "services.saveMoneyBlurb",
      label: "Save money blurb",
      value: "Lower your home energy costs with exclusive member benefits.",
      multiline: true,
    },
    { key: "services.goGreenTitle", label: "Go green title", value: "Go green" },
    {
      key: "services.goGreenBlurb",
      label: "Go green blurb",
      value: "Smart energy solutions that help your wallet and the environment.",
      multiline: true,
    },
    { key: "services.whyMemberTitle", label: "Why member title", value: "Why become a member?" },
    {
      key: "services.whyMemberBlurb",
      label: "Why member blurb",
      value: "We do the work so you can save with confidence.",
      multiline: true,
    },

    { key: "services.cardShowLess", label: "Card: show less", value: "Show less" },
    { key: "services.cardLearnMore", label: "Card: learn more", value: "Learn more" },

    { key: "services.heatingOilTitle", label: "Heating oil title", value: "Discounted Heating Oil" },
    {
      key: "services.heatingOilSummary",
      label: "Heating oil summary",
      value: "Full-service heating oil at negotiated Co-op rates from trusted local companies.",
      multiline: true,
    },
    {
      key: "services.heatingOilDetail1",
      label: "Heating oil detail 1",
      value: "All Co-op heating oil suppliers are full-service. Members typically see pricing roughly 40–50¢ below average state posted prices, with competitive service contracts and access to budget billing programs (often arranged before September 1).",
      multiline: true,
    },
    {
      key: "services.heatingOilDetail2",
      label: "Heating oil detail 2",
      value: "You become a customer of the company to which you are assigned — the Co-op is here to help if you have service or pricing questions.",
      multiline: true,
    },
    { key: "services.heatingOilLink", label: "Heating oil link", value: "See weekly heating prices →" },

    { key: "services.propaneTitle", label: "Propane title", value: "Discounted Propane" },
    {
      key: "services.propaneSummary",
      label: "Propane summary",
      value: "Competitive propane pricing — often with perks like free tank rental for members.",
      multiline: true,
    },
    {
      key: "services.propaneDetail1",
      label: "Propane detail 1",
      value: "Discounted propane pricing; many members receive added benefits such as free tank rental. The Co-op forwards your information to a participating supplier, who contacts you, performs a safety check, and coordinates tank changes as needed.",
      multiline: true,
    },
    {
      key: "services.propaneDetail2",
      label: "Propane detail 2",
      value: "Existing Co-op members can often add propane without a second membership fee. Many oil suppliers also deliver propane for stacked savings.",
      multiline: true,
    },
    { key: "services.propaneLink", label: "Propane link", value: "Propane tank FAQ →" },

    { key: "services.electricityTitle", label: "Electricity title", value: "Electricity Supply Options" },
    {
      key: "services.electricitySummary",
      label: "Electricity summary",
      value: "Compare Co-op electricity rates and shop the broader market.",
      multiline: true,
    },
    {
      key: "services.electricityDetail1",
      label: "Electricity detail 1",
      value: "Click here to see current rates available from our participating electricity supplier.",
      multiline: true,
    },
    { key: "services.electricityBtn1", label: "Electricity button 1", value: "View Co-op electricity rates" },
    {
      key: "services.electricityDetail2",
      label: "Electricity detail 2",
      value: "We want our members to get the best rate. Click here to see electricity rates outside of the Co-op.",
      multiline: true,
    },
    { key: "services.electricityBtn2", label: "Electricity button 2", value: "Compare rates on Energize CT" },

    { key: "services.insuranceTitle", label: "Insurance title", value: "Home and Auto Insurance" },
    {
      key: "services.insuranceSummary",
      label: "Insurance summary",
      value: "Discounted auto and homeowners rates through Bearingstar Insurance.",
      multiline: true,
    },
    {
      key: "services.insuranceDetail1",
      label: "Insurance detail 1",
      value: "We have partnered with Bearingstar Insurance to offer members discounted rates on auto and homeowner's insurance.",
      multiline: true,
    },
    { key: "services.insuranceBtn", label: "Insurance button", value: "Click here to request a free quote!" },

    { key: "services.solarTitle", label: "Solar title", value: "Solar Consultations" },
    {
      key: "services.solarSummary",
      label: "Solar summary",
      value: "Members who enroll through the Co-op can earn $500 when solar installation is complete.",
      multiline: true,
    },
    {
      key: "services.solarDetail1",
      label: "Solar detail 1",
      value: "Members who enroll through the Co-op receive a $500 check upon completion of the solar panel installation.",
      multiline: true,
    },
    { key: "services.solarBtn", label: "Solar button", value: "Click here to request a free consultation." },

    { key: "services.bioheatTitle", label: "Bioheat title", value: "Bioheat® (Cleaner Heating Oil)" },
    {
      key: "services.bioheatSummary",
      label: "Bioheat summary",
      value: "B20 bioheat blends biodiesel with heating oil — cleaner burn in existing equipment.",
      multiline: true,
    },
    {
      key: "services.bioheatDetail1",
      label: "Bioheat detail 1",
      value: "B20 is 80% low-sulfur No. 2 oil and 20% biodiesel — usable in existing oil equipment. Biodiesel in the blend is sourced to meet ASTM standards.",
      multiline: true,
    },
    { key: "services.bioheatDetail2", label: "Bioheat detail 2", value: "Available in many Connecticut towns." },

    { key: "services.compostTitle", label: "Compost title", value: "Composting Discounts" },
    {
      key: "services.compostSummary",
      label: "Compost summary",
      value: "Member discounts on organics and composting programs, including Blue Earth Compost.",
      multiline: true,
    },
    {
      key: "services.compostDetail1",
      label: "Compost detail 1",
      value: "The Co-op highlights additional member programs — including organics and compost offers — as seasonal benefits. Ask the office what's currently available in your area.",
      multiline: true,
    },

    { key: "services.auditsTitle", label: "Audits title", value: "Home Energy Audits" },
    {
      key: "services.auditsSummary",
      label: "Audits summary",
      value: "Discounted home energy audits through New England Smart Energy (NESE).",
      multiline: true,
    },
    {
      key: "services.auditsDetail1",
      label: "Audits detail 1",
      value: "Partner New England Smart Energy (NESE) offers audits across Connecticut with a modest copay (often around $50), including in-home measures and access to rebates on follow-up improvements.",
      multiline: true,
    },
    {
      key: "services.auditsDetail2",
      label: "Audits detail 2",
      value: "Audits are an invaluable way to reduce heat loss for your home and to access rebates on follow-up improvements.",
      multiline: true,
    },
    { key: "services.auditsBtn", label: "Audits button", value: "Click here to schedule an audit." },

    { key: "services.advocacyTitle", label: "Advocacy title", value: "Consumer Advocacy" },
    {
      key: "services.advocacySummary",
      label: "Advocacy summary",
      value: "Someone in your corner if you have a service, pricing, or billing question with your supplier.",
      multiline: true,
    },
    {
      key: "services.advocacyDetail1",
      label: "Advocacy detail 1",
      value: "Our large membership lets Citizen's Oil Co-op negotiate better contracts — and advocate for your needs with participating companies. If you have a problem, we're here to help.",
      multiline: true,
    },

    { key: "services.seniorTitle", label: "Senior title", value: "Discounts for Seniors, Veterans & First Responders" },
    {
      key: "services.seniorSummary",
      label: "Senior summary",
      value: "Reduced annual dues for seniors, with additional savings options for those who serve.",
      multiline: true,
    },
    {
      key: "services.seniorDetail1",
      label: "Senior detail 1",
      value: "Membership is $35 per year, or $25 for seniors, plus a one-time $10 application fee for new accounts. Ask the office about current offers for veterans and first responders.",
      multiline: true,
    },

    { key: "services.partnersTitle", label: "Partners title", value: "Local Partner Network" },
    {
      key: "services.partnersSummary",
      label: "Partners summary",
      value: "Trusted full-service heating companies across CT, RI, and select towns in NY and MA.",
      multiline: true,
    },
    {
      key: "services.partnersDetail1",
      label: "Partners detail 1",
      value: "We recommend the best participating company based on your location, pricing, and service preferences.",
      multiline: true,
    },
    { key: "services.partnersDetail2", label: "Partners detail 2", value: "They'll call you and set up your account at Co-op pricing." },
    { key: "services.partnersLink", label: "Partners link", value: "See coverage area →" },

    {
      key: "services.ctaText",
      label: "CTA text",
      value: "Join over 5,000 Connecticut homeowners and start saving today.",
      multiline: true,
    },
    { key: "services.ctaButton", label: "CTA button", value: "Join Now" },
  ],
};

function BenefitCardItem({
  card,
  open,
  onToggle,
}: {
  card: BenefitCard;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useSiteText();
  return (
    <button
      type="button"
      className={`mkt-svc-card${open ? " is-open" : ""}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      {card.icon}
      <span className="mkt-svc-card-title">{t(card.titleKey)}</span>
      <span className="mkt-svc-card-summary">{t(card.summaryKey)}</span>
      <span className="mkt-svc-card-more">
        {open ? t("services.cardShowLess") : t("services.cardLearnMore")}{" "}
        <span aria-hidden>{open ? "↑" : "→"}</span>
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
  const t = useSiteText();
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
            <div className="mkt-svc-detail-panel mkt-prose" role="region" aria-label={`${t(openCard.titleKey)} details`}>
              <h3>{t(openCard.titleKey)}</h3>
              {openCard.detail}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReferralCallout() {
  const t = useSiteText();
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
          <strong>{t("services.referralIntro")}</strong> {t("services.referralCopy")}{" "}
          <button
            type="button"
            className="mkt-svc-referral-toggle"
            aria-expanded={open}
            aria-controls="svc-referral-form"
            onClick={() => setOpen((prev) => !prev)}
          >
            {t("services.referralToggle")}
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
              {t("services.referralSubmit")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/** Services / member benefits page — Save Money, Go Green, Why become a member. */
export default function ServicesPage() {
  const t = useSiteText();
  return (
    <div className="mkt-services-page">
      <section className="mkt-svc-hero">
        <img src="/site/family.jpg" alt="" className="mkt-svc-hero-img" />
        <div className="mkt-svc-hero-scrim" aria-hidden />
        <div className="mkt-container mkt-svc-hero-copy">
          <h1>{t("services.heroTitle")}</h1>
          <p>{t("services.heroBlurb")}</p>
        </div>
      </section>

      <ReferralCallout />

      <CategoryBlock
        id="save-money"
        tone="green"
        title={t("services.saveMoneyTitle")}
        blurb={t("services.saveMoneyBlurb")}
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
        title={t("services.goGreenTitle")}
        blurb={t("services.goGreenBlurb")}
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
        title={t("services.whyMemberTitle")}
        blurb={t("services.whyMemberBlurb")}
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
          <p>{t("services.ctaText")}</p>
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            {t("services.ctaButton")}
          </Link>
        </div>
      </section>
    </div>
  );
}
