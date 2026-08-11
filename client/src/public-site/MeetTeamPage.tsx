import { Link } from "react-router-dom";
import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

export const MEET_TEAM_CONTENT: ContentGroup = {
  page: "team",
  title: "Meet the Team",
  fields: [
    { key: "team.title", label: "Page title", value: "Meet our team" },
    {
      key: "team.lead",
      label: "Intro paragraph",
      multiline: true,
      value:
        "The people behind the Co-op — the ones negotiating on your behalf and answering the phone when you call.",
    },
    {
      key: "team.placeholder",
      label: "Placeholder note",
      multiline: true,
      value:
        "Team photos and bios will go here. Send the names, roles, headshots, and any event pictures you'd like to feature and we'll lay them out.",
    },
    { key: "team.contactLink", label: "Contact link label", value: "Contact the office →" },
  ],
};

/** Secondary marketing page — "Meet Our Team". Content to be supplied by staff. */
export default function MeetTeamPage() {
  const t = useSiteText();
  return (
    <div className="mkt-panel" style={{ maxWidth: "760px" }}>
      <h1 className="mkt-page-title">{t("team.title")}</h1>
      <p className="mkt-lead">{t("team.lead")}</p>
      <div className="mkt-card-form">
        <p className="mkt-prose" style={{ margin: 0 }}>
          {t("team.placeholder")}
        </p>
      </div>
      <p className="mkt-lead">
        <Link to="/#contact">{t("team.contactLink")}</Link>
      </p>
    </div>
  );
}
