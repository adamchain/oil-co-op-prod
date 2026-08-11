import { Link } from "react-router-dom";
import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

export const TESTIMONIALS_CONTENT: ContentGroup = {
  page: "testimonials",
  title: "Testimonials",
  fields: [
    { key: "testimonials.title", label: "Page title", value: "Member testimonials" },
    {
      key: "testimonials.lead",
      label: "Intro paragraph",
      value: "What members say about saving with the Co-op.",
    },
    {
      key: "testimonials.quote1",
      label: "Quote 1 text",
      multiline: true,
      value:
        "“The reduced per-gallon cost helps our household budget — we keep telling friends about the program.”",
    },
    {
      key: "testimonials.cite1",
      label: "Quote 1 attribution",
      value: "Mark & Alison Laucella, Middletown · members since 2007",
    },
    {
      key: "testimonials.quote2",
      label: "Quote 2 text",
      multiline: true,
      value:
        "“Switching home and auto insurance through the Co-op's Bearingstar program saved hundreds compared to our old carrier.”",
    },
    { key: "testimonials.cite2", label: "Quote 2 attribution", value: "Member testimonial (insurance)" },
    {
      key: "testimonials.placeholder",
      label: "Placeholder note",
      multiline: true,
      value:
        "The member video and additional testimonials will live here. Send any quotes or the video link you'd like featured.",
    },
    { key: "testimonials.joinButton", label: "Join button label", value: "Join Now" },
  ],
};

/** Secondary marketing page — "Testimonials". Member quotes + video live here. */
export default function TestimonialsPage() {
  const t = useSiteText();
  return (
    <div className="mkt-panel" style={{ maxWidth: "760px" }}>
      <h1 className="mkt-page-title">{t("testimonials.title")}</h1>
      <p className="mkt-lead">{t("testimonials.lead")}</p>

      <div className="mkt-testimonials" style={{ marginBottom: "2rem" }}>
        <figure className="mkt-quote-card">
          <blockquote>{t("testimonials.quote1")}</blockquote>
          <cite>{t("testimonials.cite1")}</cite>
        </figure>
        <figure className="mkt-quote-card">
          <blockquote>{t("testimonials.quote2")}</blockquote>
          <cite>{t("testimonials.cite2")}</cite>
        </figure>
      </div>

      <div className="mkt-card-form">
        <p className="mkt-prose" style={{ margin: 0 }}>
          {t("testimonials.placeholder")}
        </p>
      </div>

      <p className="mkt-lead">
        <Link to="/signup" className="mkt-btn mkt-btn-primary">
          {t("testimonials.joinButton")}
        </Link>
      </p>
    </div>
  );
}
