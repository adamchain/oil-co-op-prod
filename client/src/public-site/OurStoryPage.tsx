import { Link } from "react-router-dom";

/** Secondary marketing page — "Our Story". Content to be supplied by staff. */
export default function OurStoryPage() {
  return (
    <div className="mkt-panel" style={{ maxWidth: "760px" }}>
      <h1 className="mkt-page-title">Our story</h1>
      <p className="mkt-lead">
        Founded in <strong>1981</strong> and incorporated in <strong>1992</strong>, Citizen&apos;s Oil Co-op is a
        family-owned buyers&apos; club that has grown to over 3,000 members across Connecticut, Rhode Island, and parts
        of New York and Massachusetts — all with one mission: affordable, quality full-service energy and a real
        advocate for members.
      </p>
      <div className="mkt-card-form">
        <p className="mkt-prose" style={{ margin: 0 }}>
          More of the Co-op&apos;s history, milestones, and photos will live here. Send the copy and images you&apos;d
          like to feature and we&apos;ll add them.
        </p>
      </div>
      <p className="mkt-lead">
        <Link to="/#membership">Learn about membership →</Link>
      </p>
    </div>
  );
}
