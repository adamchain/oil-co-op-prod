import { Link } from "react-router-dom";
import {
  StepsSection,
  TownsSection,
  ValueBand,
  SavingsSection,
  WhyChooseSection,
  ImageSlot,
} from "./homeSections";

/**
 * Citizen's Oil Co-op public marketing homepage.
 * Lean, conversion-first order per the 7/21 client notes:
 * hero (with this-week's price) → how it works (3 steps, first thing a
 * visitor sees) → the 3 C's → real savings → why choose → towns we serve.
 * Photography drops into the wired <ImageSlot> placeholders.
 */

// Weekly posted average — placeholder value; update from the office / oilco-op.com.
const WEEKLY_OIL_PRICE = "$4.899";

function Hero() {
  return (
    <section className="mkt-hero mkt-hero--pro">
      <div className="mkt-hero-bg" aria-hidden />
      <div className="mkt-hero-inner">
        <p className="mkt-hero-tag">Heating oil · Propane · and more</p>
        <h1>Stop overpaying for heating oil &amp; propane.</h1>
        <p>
          Join the region&apos;s trusted buyers&apos; club and receive discounted pricing from local, full-service
          heating companies — with someone in your corner if something goes wrong.
        </p>
        <div className="mkt-hero-actions">
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Become a member
          </Link>
          <div className="mkt-hero-price" role="group" aria-label="This week's average heating oil price">
            <span className="mkt-hero-price-label">This week&apos;s avg. heating oil</span>
            <span className="mkt-hero-price-value">{WEEKLY_OIL_PRICE}<span className="mkt-hero-price-unit">/gal</span></span>
            <a
              href="https://oilco-op.com/"
              className="mkt-hero-price-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              See full pricing
            </a>
          </div>
        </div>
        <p className="mkt-hero-check">
          <span className="mkt-check-badge" aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Over 5,000 families across CT, RI, NY &amp; MA are already saving.
        </p>
      </div>
      <div className="mkt-hero-media">
        <ImageSlot
          src="/site/truck.jpg"
          alt="A heating-oil delivery truck at a member's home"
          label="Photo: heating-oil delivery at a member's home"
          className="mkt-img-slot--hero"
        />
      </div>
    </section>
  );
}

export default function PublicHomePage() {
  return (
    <>
      <Hero />
      <StepsSection />
      <ValueBand />
      <SavingsSection />
      <WhyChooseSection />
      <TownsSection />
    </>
  );
}
