import { Link } from "react-router-dom";

/** Secondary marketing page — "Meet Our Team". Content to be supplied by staff. */
export default function MeetTeamPage() {
  return (
    <div className="mkt-panel" style={{ maxWidth: "760px" }}>
      <h1 className="mkt-page-title">Meet our team</h1>
      <p className="mkt-lead">
        The people behind the Co-op — the ones negotiating on your behalf and answering the phone when you call.
      </p>
      <div className="mkt-card-form">
        <p className="mkt-prose" style={{ margin: 0 }}>
          Team photos and bios will go here. Send the names, roles, headshots, and any event pictures you&apos;d like to
          feature and we&apos;ll lay them out.
        </p>
      </div>
      <p className="mkt-lead">
        <Link to="/#contact">Contact the office →</Link>
      </p>
    </div>
  );
}
