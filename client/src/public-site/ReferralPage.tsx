import { Link } from "react-router-dom";

/** Referral program secondary page. */
export default function ReferralPage() {
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">Referral program</h1>
      <p className="mkt-lead">
        Share the Co-op with friends and neighbors — and earn membership rewards when they join and stay active.
      </p>

      <div className="mkt-svc-grid mkt-svc-grid--2" style={{ marginBottom: "2rem" }}>
        <article className="mkt-svc-card mkt-svc-card--static">
          <h2 className="mkt-svc-card-title" style={{ margin: "0 0 0.5rem" }}>
            Refer five, dues waived for life
          </h2>
          <p className="mkt-svc-card-summary" style={{ margin: 0 }}>
            Refer five new active members and become a lifetime member with no annual dues.
          </p>
        </article>
        <article className="mkt-svc-card mkt-svc-card--static">
          <h2 className="mkt-svc-card-title" style={{ margin: "0 0 0.5rem" }}>
            Individual referrals
          </h2>
          <p className="mkt-svc-card-summary" style={{ margin: 0 }}>
            Individual referrals may qualify for waived dues in an upcoming season or promotional raffles (e.g. gift
            cards) when announced.
          </p>
        </article>
      </div>

      <div className="mkt-prose" style={{ marginBottom: "1.5rem" }}>
        <p>
          Use the <strong>Refer a member</strong> form in the footer on any page, or call{" "}
          <a href="tel:8605616011">860-561-6011</a> and we&apos;ll follow up with your friend directly.
        </p>
        <p>
          Note: Next Step nonprofit donations and the member referral program cannot be combined on the same signup.
        </p>
      </div>

      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link to="/signup" className="mkt-btn mkt-btn-primary">
          Join Now
        </Link>
        <a href="#refer" className="mkt-btn mkt-btn-ghost" onClick={(e) => {
          e.preventDefault();
          document.querySelector(".mkt-footer-refer")?.scrollIntoView({ behavior: "smooth" });
        }}>
          Refer someone →
        </a>
      </p>
    </div>
  );
}
