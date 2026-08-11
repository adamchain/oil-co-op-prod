import { Link } from "react-router-dom";
import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

/** Editable copy for the "Our Story" page. */
export const OUR_STORY_CONTENT: ContentGroup = {
  page: "ourStory",
  title: "Our Story",
  fields: [
    { key: "ourStory.title", label: "Page title", value: "Our story" },
    {
      key: "ourStory.lead",
      label: "Intro paragraph",
      multiline: true,
      value:
        "Founded in 1981 and incorporated in 1992, Citizen's Oil Co-op is a family-owned buyers' club that has grown to over 3,000 members across Connecticut, Rhode Island, and parts of New York and Massachusetts — all with one mission: affordable, quality full-service energy and a real advocate for members.",
    },
    {
      key: "ourStory.placeholder",
      label: "History placeholder card",
      multiline: true,
      value:
        "More of the Co-op's history, milestones, and photos will live here. Send the copy and images you'd like to feature and we'll add them.",
    },
    { key: "ourStory.membershipLink", label: "Membership link", value: "Learn about membership →" },
  ],
};

/** Secondary marketing page — "Our Story". Content editable in Admin → Site Content. */
export default function OurStoryPage() {
  const t = useSiteText();
  return (
    <div className="mkt-panel" style={{ maxWidth: "760px" }}>
      <h1 className="mkt-page-title">{t("ourStory.title")}</h1>
      <p className="mkt-lead">{t("ourStory.lead")}</p>
      <div className="mkt-card-form">
        <p className="mkt-prose" style={{ margin: 0 }}>
          {t("ourStory.placeholder")}
        </p>
      </div>
      <p className="mkt-lead">
        <Link to="/#membership">{t("ourStory.membershipLink")}</Link>
      </p>
    </div>
  );
}
