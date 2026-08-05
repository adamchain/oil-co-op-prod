import { useEffect, useRef, useState } from "react";
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
 * Order per 7/30 client notes:
 * hero → how it works (3 steps) → towns we serve → real savings →
 * why choose → value band (3 C's) at the bottom.
 *
 * Hero area ships several layout examples in a horizontal scroller
 * so staff can compare directions (price strip, price-first, etc.).
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

function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroPhoneLink({ className = "mkt-hero-phone" }: { className?: string }) {
  return (
    <a href="tel:8605616011" className={className}>
      <PhoneIcon />
      860-561-6011
    </a>
  );
}

function CheckLine() {
  return (
    <p className="mkt-hero-check">
      <span className="mkt-check-badge" aria-hidden>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Over 5,000 families across CT, RI, NY &amp; MA are already saving.
    </p>
  );
}

/** A — Current pro split: CTA + compact price strip + media */
function HeroPro({ price }: { price: CurrentOilPrice | null }) {
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
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-hero-join">
            Join Now
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
              <Link to="/heating-prices" className="mkt-hero-price-link" onClick={(e) => e.stopPropagation()}>
                See full pricing
              </Link>
            </div>
          </div>
        </div>
        <HeroPhoneLink />
        <CheckLine />
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

/** B — Large price stacked above the headline */
function HeroPriceAbove({ price }: { price: CurrentOilPrice | null }) {
  return (
    <section className="mkt-hero mkt-hero--price-above">
      <div className="mkt-hero-bg" aria-hidden />
      <div className="mkt-hero-inner mkt-hero-inner--center">
        <p className="mkt-hero-tag">This week&apos;s Co-op heating oil</p>
        <div className="mkt-hero-price-hero" role="group" aria-label="This week's average heating oil price">
          <span className="mkt-hero-price-hero-value">
            {price ? formatPrice(price.coopPrice) : "—"}
            <span className="mkt-hero-price-hero-unit">/gal</span>
          </span>
          {price && <span className="mkt-hero-price-hero-week">week of {formatWeekOf(price.weekOf)}</span>}
        </div>
        <h1>Stop overpaying for heating oil &amp; propane.</h1>
        <p>
          Group-negotiated rates from local, full-service companies — with someone in your corner if something goes
          wrong.
        </p>
        <div className="mkt-hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Join Now
          </Link>
          <HeroPhoneLink className="mkt-btn mkt-btn-ghost mkt-btn-lg mkt-hero-phone-btn" />
        </div>
        <p className="mkt-hero-price-hero-link-wrap">
          <Link to="/heating-prices" className="mkt-hero-price-link">
            See full pricing →
          </Link>
        </p>
        <CheckLine />
      </div>
    </section>
  );
}

/** C — Price as the focal panel beside short copy */
function HeroPriceFocus({ price }: { price: CurrentOilPrice | null }) {
  return (
    <section className="mkt-hero mkt-hero--price-focus">
      <div className="mkt-hero-bg" aria-hidden />
      <aside className="mkt-hero-price-panel" aria-label="This week's average heating oil price">
        <span className="mkt-hero-price-panel-label">This week&apos;s avg. heating oil</span>
        <span className="mkt-hero-price-panel-value">
          {price ? formatPrice(price.coopPrice) : "—"}
          <span className="mkt-hero-price-panel-unit">/gal</span>
        </span>
        {price && <span className="mkt-hero-price-panel-week">week of {formatWeekOf(price.weekOf)}</span>}
        <Link to="/heating-prices" className="mkt-btn mkt-btn-ghost" style={{ marginTop: "1.25rem", width: "100%" }}>
          See full pricing
        </Link>
      </aside>
      <div className="mkt-hero-inner">
        <p className="mkt-hero-tag">Heating oil · Propane · and more</p>
        <h1>The price members pay.</h1>
        <p>
          Join Citizen&apos;s Oil Co-op for discounted full-service delivery — negotiated as a group, delivered by
          local companies you can trust.
        </p>
        <div className="mkt-hero-actions">
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Join Now
          </Link>
          <HeroPhoneLink className="mkt-btn mkt-btn-ghost mkt-btn-lg mkt-hero-phone-btn" />
        </div>
        <CheckLine />
      </div>
    </section>
  );
}

/** D — Green banner with oversized price */
function HeroBannerPrice({ price }: { price: CurrentOilPrice | null }) {
  return (
    <section className="mkt-hero-banner mkt-hero-banner--price">
      <div className="mkt-hero-banner-inner">
        <p className="mkt-hero-banner-tag">Citizen&apos;s Oil Co-op · this week</p>
        <div className="mkt-hero-banner-price-xl" role="group" aria-label="This week's average heating oil price">
          <span className="mkt-hero-banner-price-xl-value">
            {price ? formatPrice(price.coopPrice) : "—"}
            <span className="mkt-hero-banner-price-xl-unit">/gal</span>
          </span>
          {price && <span className="mkt-hero-banner-price-xl-week">week of {formatWeekOf(price.weekOf)}</span>}
        </div>
        <h1>Stop overpaying for heating oil &amp; propane.</h1>
        <p>Group-negotiated pricing on full-service heating oil and propane across CT, RI, NY &amp; MA.</p>
        <div className="mkt-hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/signup" className="mkt-btn mkt-btn-lg mkt-btn-on-accent">
            Join Now
          </Link>
          <a href="tel:8605616011" className="mkt-btn mkt-btn-lg mkt-btn-ghost-light mkt-hero-phone-btn">
            <PhoneIcon size={18} />
            860-561-6011
          </a>
        </div>
        <p className="mkt-hero-banner-price-note" style={{ marginTop: "1.25rem" }}>
          <Link to="/heating-prices" style={{ color: "#fff", fontWeight: 600 }}>
            See full pricing →
          </Link>
        </p>
      </div>
    </section>
  );
}

const HERO_EXAMPLES = [
  { key: "pro", label: "A · Split + price strip", render: (p: CurrentOilPrice | null) => <HeroPro price={p} /> },
  { key: "above", label: "B · Price above headline", render: (p: CurrentOilPrice | null) => <HeroPriceAbove price={p} /> },
  { key: "focus", label: "C · Price panel focus", render: (p: CurrentOilPrice | null) => <HeroPriceFocus price={p} /> },
  { key: "banner", label: "D · Banner price hero", render: (p: CurrentOilPrice | null) => <HeroBannerPrice price={p} /> },
] as const;

function HeroGallery() {
  const [price, setPrice] = useState<CurrentOilPrice | null>(null);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const slideWidth = track.clientWidth;
      if (slideWidth <= 0) return;
      const index = Math.round(track.scrollLeft / slideWidth);
      setActive(Math.max(0, Math.min(index, HERO_EXAMPLES.length - 1)));
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(index, HERO_EXAMPLES.length - 1));
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    setActive(next);
  };

  return (
    <div className="mkt-hero-gallery">
      <div className="mkt-hero-gallery-chrome">
        <p className="mkt-hero-gallery-label">Hero layout examples — swipe or use arrows</p>
        <div className="mkt-hero-gallery-nav">
          <button
            type="button"
            className="mkt-hero-gallery-arrow"
            aria-label="Previous hero example"
            disabled={active === 0}
            onClick={() => scrollTo(active - 1)}
          >
            ‹
          </button>
          <div className="mkt-slide-dots" role="tablist" aria-label="Hero examples">
            {HERO_EXAMPLES.map((ex, i) => (
              <button
                key={ex.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={ex.label}
                className={i === active ? "active" : ""}
                onClick={() => scrollTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="mkt-hero-gallery-arrow"
            aria-label="Next hero example"
            disabled={active === HERO_EXAMPLES.length - 1}
            onClick={() => scrollTo(active + 1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="mkt-hero-gallery-track" ref={trackRef}>
        {HERO_EXAMPLES.map((ex) => (
          <div className="mkt-hero-gallery-slide" key={ex.key}>
            <p className="mkt-hero-slide-label">{ex.label}</p>
            {ex.render(price)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <>
      <HeroGallery />
      <StepsSection />
      <TownsSection />
      <SavingsSection />
      <WhyChooseSection />
      <ValueBand />
    </>
  );
}
