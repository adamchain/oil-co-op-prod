import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PriceCard, StepsSection, TownsSection, FuelCards, HomeBody } from "./homeSections";

/**
 * Citizen's Oil Co-op public marketing homepage.
 * Ships three switchable layout options (A/B/C) so staff can compare directions;
 * a floating switcher persists the choice. Content sections are shared across all three.
 */

type LayoutKey = "a" | "b" | "c";

const LAYOUTS: { key: LayoutKey; label: string; note: string }[] = [
  { key: "a", label: "Streamlined", note: "Split hero · price card" },
  { key: "b", label: "Bold Banner", note: "Green banner · fuel cards" },
  { key: "c", label: "Minimal", note: "Big centered headline" },
];

/* ---------- Hero variants ---------- */

function HeroClassic() {
  return (
    <section className="mkt-hero">
      <div className="mkt-hero-bg" aria-hidden />
      <div className="mkt-hero-inner">
        <p className="mkt-hero-tag">Heating oil · Propane · and more</p>
        <h1>Stop Over Paying for your Heating Fuel.</h1>
        <p>
          Citizen&apos;s Oil Co-op negotiates group pricing so members pay less for full-service heating oil and propane
          — with someone in your corner if something goes wrong.
        </p>
        <div className="mkt-hero-actions">
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Join the Co-op
          </Link>
          <a href="tel:8605616011" className="mkt-btn mkt-btn-ghost mkt-btn-lg">
            Call 860-561-6011
          </a>
        </div>
        <div className="mkt-hero-trust">
          <span>
            <strong>3,000+</strong> members
          </span>
          <span>
            <strong>30+</strong> years negotiating
          </span>
          <span>
            <strong>$250–$300</strong> typical seasonal savings
          </span>
        </div>
      </div>
      <PriceCard />
    </section>
  );
}

function HeroBanner() {
  return (
    <section className="mkt-hero-banner">
      <div className="mkt-hero-banner-inner">
        <img src="/coop-logo.png" alt="Citizen's Oil Co-op" className="mkt-hero-banner-logo" />
        <p className="mkt-hero-banner-tag">Citizen&apos;s Oil Co-op</p>
        <h1>Stop Over Paying for your Heating Fuel.</h1>
        <p>Group-negotiated pricing on full-service heating oil and propane across CT, RI, NY &amp; MA.</p>
        <div className="mkt-hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/signup" className="mkt-btn mkt-btn-lg mkt-btn-on-accent">
            Join the Co-op
          </Link>
          <a href="tel:8605616011" className="mkt-btn mkt-btn-lg mkt-btn-ghost-light">
            Call 860-561-6011
          </a>
        </div>
        <div className="mkt-hero-banner-price">
          <span className="mkt-hero-banner-price-label">Average heating oil price</span>
          <span className="mkt-hero-banner-price-value">$4.899</span>
          <span className="mkt-hero-banner-price-note">week of 03/30/26</span>
        </div>
      </div>
    </section>
  );
}

function HeroMinimal() {
  return (
    <section className="mkt-hero-minimal">
      <div className="mkt-hero-minimal-inner">
        <p className="mkt-hero-tag">Heating oil · Propane · and more</p>
        <h1>Stop Over Paying for your Heating Fuel.</h1>
        <p>Members across CT, RI, NY &amp; MA save with group-negotiated, full-service pricing.</p>
        <div className="mkt-hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Join the Co-op
          </Link>
          <a href="tel:8605616011" className="mkt-btn mkt-btn-ghost mkt-btn-lg">
            Call 860-561-6011
          </a>
        </div>
        <div className="mkt-hero-minimal-price">
          <strong>$4.899</strong> avg. heating oil price · week of 03/30/26
        </div>
      </div>
    </section>
  );
}

/* ---------- Switcher ---------- */

function readInitialLayout(): LayoutKey {
  const fromUrl = new URLSearchParams(window.location.search).get("layout");
  if (fromUrl === "a" || fromUrl === "b" || fromUrl === "c") return fromUrl;
  const stored = window.localStorage.getItem("coop_layout");
  if (stored === "a" || stored === "b" || stored === "c") return stored;
  return "a";
}

function LayoutSwitcher({ value, onChange }: { value: LayoutKey; onChange: (k: LayoutKey) => void }) {
  return (
    <div className="mkt-layout-switch" role="group" aria-label="Preview layout options">
      <span className="mkt-layout-switch-label">Layout preview</span>
      <div className="mkt-layout-switch-btns">
        {LAYOUTS.map((l) => (
          <button
            key={l.key}
            type="button"
            className={l.key === value ? "active" : ""}
            onClick={() => onChange(l.key)}
            title={l.note}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function PublicHomePage() {
  const [layout, setLayout] = useState<LayoutKey>(readInitialLayout);

  useEffect(() => {
    window.localStorage.setItem("coop_layout", layout);
    window.scrollTo({ top: 0 });
  }, [layout]);

  return (
    <>
      {layout === "a" && (
        <>
          <HeroClassic />
          <StepsSection />
          <TownsSection />
        </>
      )}
      {layout === "b" && (
        <>
          <HeroBanner />
          <FuelCards />
          <StepsSection />
          <TownsSection />
        </>
      )}
      {layout === "c" && (
        <>
          <HeroMinimal />
          <TownsSection />
          <StepsSection />
        </>
      )}

      <HomeBody />

      <LayoutSwitcher value={layout} onChange={setLayout} />
    </>
  );
}
