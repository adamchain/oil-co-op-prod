import { Link } from "react-router-dom";
import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

export const REFERRAL_CONTENT: ContentGroup = {
  page: "referral",
  title: "Referral",
  fields: [
    { key: "referral.title", label: "Page title", value: "Referral program" },
    {
      key: "referral.lead",
      label: "Intro paragraph",
      multiline: true,
      value:
        "Share the Co-op with friends and neighbors — and earn membership rewards when they join and stay active.",
    },
    { key: "referral.card1Title", label: "Card 1 title", value: "Refer five, dues waived for life" },
    {
      key: "referral.card1Summary",
      label: "Card 1 summary",
      multiline: true,
      value: "Refer five new active members and become a lifetime member with no annual dues.",
    },
    { key: "referral.card2Title", label: "Card 2 title", value: "Individual referrals" },
    {
      key: "referral.card2Summary",
      label: "Card 2 summary",
      multiline: true,
      value:
        "Individual referrals may qualify for waived dues in an upcoming season or promotional raffles (e.g. gift cards) when announced.",
    },
    { key: "referral.formTextBefore", label: "Refer paragraph, before form name", value: "Use the " },
    { key: "referral.formName", label: "Refer form name", value: "Refer a member" },
    { key: "referral.formTextMid", label: "Refer paragraph, before phone", value: " form in the footer on any page, or call " },
    { key: "referral.phone", label: "Phone number link text", value: "860-561-6011" },
    {
      key: "referral.formTextAfter",
      label: "Refer paragraph, after phone",
      value: " and we'll follow up with your friend directly.",
    },
    {
      key: "referral.note",
      label: "Combination note",
      multiline: true,
      value:
        "Note: Next Step nonprofit donations and the member referral program cannot be combined on the same signup.",
    },
    { key: "referral.joinButton", label: "Join button label", value: "Join Now" },
    { key: "referral.referButton", label: "Refer button label", value: "Refer someone →" },
  ],
};

/** Referral program secondary page. */
export default function ReferralPage() {
  const t = useSiteText();
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">{t("referral.title")}</h1>
      <p className="mkt-lead">{t("referral.lead")}</p>

      <div className="mkt-svc-grid mkt-svc-grid--2" style={{ marginBottom: "2rem" }}>
        <article className="mkt-svc-card mkt-svc-card--static">
          <h2 className="mkt-svc-card-title" style={{ margin: "0 0 0.5rem" }}>
            {t("referral.card1Title")}
          </h2>
          <p className="mkt-svc-card-summary" style={{ margin: 0 }}>
            {t("referral.card1Summary")}
          </p>
        </article>
        <article className="mkt-svc-card mkt-svc-card--static">
          <h2 className="mkt-svc-card-title" style={{ margin: "0 0 0.5rem" }}>
            {t("referral.card2Title")}
          </h2>
          <p className="mkt-svc-card-summary" style={{ margin: 0 }}>
            {t("referral.card2Summary")}
          </p>
        </article>
      </div>

      <div className="mkt-prose" style={{ marginBottom: "1.5rem" }}>
        <p>
          {t("referral.formTextBefore")}
          <strong>{t("referral.formName")}</strong>
          {t("referral.formTextMid")}
          <a href="tel:8605616011">{t("referral.phone")}</a>
          {t("referral.formTextAfter")}
        </p>
        <p>{t("referral.note")}</p>
      </div>

      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link to="/signup" className="mkt-btn mkt-btn-primary">
          {t("referral.joinButton")}
        </Link>
        <a href="#refer" className="mkt-btn mkt-btn-ghost" onClick={(e) => {
          e.preventDefault();
          document.querySelector(".mkt-footer-refer")?.scrollIntoView({ behavior: "smooth" });
        }}>
          {t("referral.referButton")}
        </a>
      </p>
    </div>
  );
}
