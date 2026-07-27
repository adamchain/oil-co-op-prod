import { Link } from "react-router-dom";

const PARTNERS = [
  {
    name: "Roxbury Fuel Bank",
    blurb: "Give-back per new member to support neighbors in need of heating assistance.",
  },
  {
    name: "West Hartford Youth Basketball League (WHYBL)",
    blurb: "Long-running team sponsorship and Next Step program participation.",
  },
  {
    name: "Buena Vista Property Owners Association",
    blurb: "Neighborhood partnership for savings and fundraising.",
  },
  {
    name: "Connecticut Citizen Action Group (CCAG)",
    blurb: "Historic ties — CCAG helped launch the Co-op; ongoing consumer-rights work.",
  },
  {
    name: "Friends of Fernridge Park",
    blurb: "Events and preservation support in West Hartford.",
  },
  {
    name: "Our Lady of Calvary Retreat Center",
    blurb: "Golf fundraiser support and donations over multiple years.",
  },
];

/** Community involvement / partnerships secondary page. */
export default function CommunityPage() {
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">Community involvement</h1>
      <p className="mkt-lead">
        The Co-op donates and sponsors local organizations — because saving together should also mean giving back.
      </p>

      <div className="mkt-svc-grid mkt-svc-grid--2" style={{ marginBottom: "2rem" }}>
        {PARTNERS.map((p) => (
          <article key={p.name} className="mkt-svc-card mkt-svc-card--static">
            <h2 className="mkt-svc-card-title" style={{ margin: "0 0 0.5rem" }}>
              {p.name}
            </h2>
            <p className="mkt-svc-card-summary" style={{ margin: 0 }}>
              {p.blurb}
            </p>
          </article>
        ))}
      </div>

      <div className="mkt-callout" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>The Next Step program</h3>
        <p className="mkt-prose" style={{ marginBottom: 0 }}>
          When you join, you can designate a nonprofit to receive a $10 donation from the Co-op through Next Step —
          another way membership supports the organizations you care about. Next Step and the member referral program
          cannot be combined on the same signup.
        </p>
      </div>

      <p className="mkt-lead">
        <Link to="/signup">Become a member →</Link>
      </p>
    </div>
  );
}
