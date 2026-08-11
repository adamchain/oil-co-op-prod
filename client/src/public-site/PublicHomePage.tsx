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
import { useSiteText } from "./content/SiteContentContext";

/**
 * Citizen's Oil Co-op public marketing homepage.
 * Hero: Option B (price above headline) — selected 8/6/26 client notes.
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
  return `${Number(m[2])}/${Number(m[3])}/${m[1].slice(2)}`;
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
  const t = useSiteText();
  return (
    <a href="tel:8605616011" className={className}>
      <PhoneIcon />
      {t("home.heroPhone")}
    </a>
  );
}

function CheckLine() {
  const t = useSiteText();
  return (
    <p className="mkt-hero-check">
      <span className="mkt-check-badge" aria-hidden>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {t("home.heroCheckLine")}
    </p>
  );
}

/** Option B — large price stacked above the headline + media */
function HeroPriceAbove({ price }: { price: CurrentOilPrice | null }) {
  const t = useSiteText();
  return (
    <section className="mkt-hero mkt-hero--price-above">
      <div className="mkt-hero-bg" aria-hidden />
      <div className="mkt-hero-inner">
        <div className="mkt-hero-price-hero" role="group" aria-label="Average heating oil price">
          <span className="mkt-hero-price-hero-value">
            {price ? formatPrice(price.coopPrice) : "—"}
            <span className="mkt-hero-price-hero-unit">{t("home.heroPriceUnit")}</span>
          </span>
          {price && (
            <span className="mkt-hero-price-hero-week">
              {t("home.heroPriceWeekPrefix")}
              {formatWeekOf(price.weekOf)}
            </span>
          )}
        </div>
        <h1>{t("home.heroHeadline")}</h1>
        <p>{t("home.heroLead")}</p>
        <div className="mkt-hero-actions">
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            {t("home.heroJoinCta")}
          </Link>
          <HeroPhoneLink className="mkt-btn mkt-btn-ghost mkt-btn-lg mkt-hero-phone-btn" />
        </div>
        <p className="mkt-hero-price-hero-link-wrap">
          <Link to="/heating-prices" className="mkt-hero-price-link">
            {t("home.heroPricingLink")}
          </Link>
        </p>
        <CheckLine />
      </div>
      <div className="mkt-hero-media mkt-hero-media--compact">
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
    <>
      <HeroPriceAbove price={price} />
      <StepsSection />
      <TownsSection />
      <SavingsSection />
      <WhyChooseSection />
      <ValueBand />
    </>
  );
}
