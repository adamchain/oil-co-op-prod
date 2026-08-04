import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
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

type CurrentOilPrice = {
  weekOf: string;
  coopPrice: number;
};

function formatPrice(n: number): string {
  return `$${n.toFixed(3)}`;
}

function formatWeekOf(weekOf: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekOf);
  if (!m) return weekOf;
  return `${m[2]}/${m[3]}/${m[1].slice(2)}`;
}

function Hero() {
  const [price, setPrice] = useState<CurrentOilPrice | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ oilPrice: CurrentOilPrice }>("/api/oil-prices/current")
      .then((res) => {
        if (!cancelled && res.oilPrice) setPrice(res.oilPrice);
      })
      .catch(() => {
        /* keep empty until office publishes a row */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="mkt-hero-price-main">
              <span className="mkt-hero-price-label">This week&apos;s avg. heating oil</span>
              <span className="mkt-hero-price-value">
                {price ? formatPrice(price.coopPrice) : "—"}
                <span className="mkt-hero-price-unit">/gal</span>
              </span>
            </div>
            <div className="mkt-hero-price-meta">
              {price && <span className="mkt-hero-price-week">week of {formatWeekOf(price.weekOf)}</span>}
              <Link
                to="/heating-prices"
                className="mkt-hero-price-link"
                onClick={(e) => e.stopPropagation()}
              >
                See full pricing
              </Link>
            </div>
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
