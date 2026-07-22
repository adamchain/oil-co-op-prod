import { Link } from "react-router-dom";

/**
 * Shared building blocks for the public homepage layout options.
 * Heroes and top-of-page ordering vary per layout; these sections are reused.
 */

function ServiceDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details>
      <summary>{title}</summary>
      <div className="mkt-acc-body mkt-prose">{children}</div>
    </details>
  );
}

/** Price card — used in the hero on some layouts. */
export function PriceCard() {
  return (
    <aside className="mkt-price-card" aria-live="polite">
      <span className="mkt-price-label">Average heating oil price</span>
      <span className="mkt-price-value">$ 4.899</span>
      <span className="mkt-price-period">week of 03/30/26 · see oilco-op.com for current posted price</span>
      <a
        href="https://oilco-op.com/"
        className="mkt-btn mkt-btn-ghost"
        style={{ marginTop: "1rem", width: "100%" }}
        target="_blank"
        rel="noopener noreferrer"
      >
        Price comparison on oilco-op.com
      </a>
    </aside>
  );
}

/** Three sign-up steps + "Call today and join!" */
export function StepsSection() {
  return (
    <section className="mkt-section mkt-steps" id="how">
      <div className="mkt-container">
        <p className="mkt-eyebrow">How it works</p>
        <h2 className="mkt-section-title">Saving starts in three simple steps</h2>
        <div className="mkt-rule" aria-hidden />
        <ul className="mkt-steps-list">
          <li className="mkt-step">
            <span className="mkt-step-num">1</span>
            <h3>Join Citizen&apos;s Oil Co-op</h3>
            <p>Apply online or call the office. Pay the application fee and annual membership.</p>
          </li>
          <li className="mkt-step">
            <span className="mkt-step-num">2</span>
            <h3>We connect you with a participating company</h3>
            <p>We match you with a full-service supplier that serves your town under Co-op pricing.</p>
          </li>
          <li className="mkt-step">
            <span className="mkt-step-num">3</span>
            <h3>They call you to set up service</h3>
            <p>Your supplier sets up the account, delivery, and billing — at the discounted Co-op rate.</p>
          </li>
        </ul>
        <div className="mkt-hero-actions" style={{ justifyContent: "center", marginTop: "2rem" }}>
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Call today and join!
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Coverage by state. */
export function TownsSection() {
  return (
    <section className="mkt-section" id="towns" style={{ background: "var(--color-bg-alt)" }}>
      <div className="mkt-container">
        <h2 className="mkt-section-title">Towns we serve</h2>
        <p className="mkt-section-sub">
          Members across four states. Not sure if we cover your town? Call and we&apos;ll confirm.
        </p>
        <div className="mkt-coverage">
          <div className="mkt-coverage-card">
            <h3>Connecticut</h3>
            <p>Every town, statewide</p>
          </div>
          <div className="mkt-coverage-card">
            <h3>Rhode Island</h3>
            <p>Every town, statewide</p>
          </div>
          <div className="mkt-coverage-card">
            <h3>Massachusetts</h3>
            <p>Worcester, Norfolk &amp; Bristol counties</p>
          </div>
          <div className="mkt-coverage-card">
            <h3>New York</h3>
            <p>Westchester County</p>
          </div>
        </div>
        <p className="mkt-sync-note" style={{ textAlign: "center", marginTop: "1.5rem" }}>
          Coverage shown is approximate — final town/region list to be confirmed by the office.
        </p>
      </div>
    </section>
  );
}

/** Fuel-type cards (Our Town–style) — used on the banner layout. */
export function FuelCards() {
  const fuels = [
    { name: "Heating oil", desc: "Full-service delivery at negotiated Co-op rates." },
    { name: "Propane", desc: "Discounted propane — often with free tank rental." },
    { name: "Bioheat (B20)", desc: "Cleaner oil blend for your existing equipment." },
    { name: "Solar", desc: "On-site clean generation at a fixed energy rate." },
  ];
  return (
    <section className="mkt-section" id="fuels">
      <div className="mkt-container">
        <h2 className="mkt-section-title">What we offer</h2>
        <p className="mkt-section-sub">One membership, savings across your home energy.</p>
        <div className="mkt-fuel-grid">
          {fuels.map((f) => (
            <div className="mkt-fuel-card" key={f.name}>
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Everything below the top of the page — shared by every layout. */
export function HomeBody() {
  return (
    <>
      <section className="mkt-section mkt-about" id="about">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Oil Co-op members pay less</h2>
          <p className="mkt-section-sub">
            Citizen&apos;s Oil Co-op is a buyers&apos; club: strength in numbers for lower prices and someone in your
            corner if something goes wrong.
          </p>
          <div className="mkt-split">
            <div className="mkt-prose">
              <p>
                Through group purchasing, members typically save <strong>$250–$300 a heating season</strong> — often{" "}
                <strong>40–60¢ per gallon</strong> below average posted prices. And membership is{" "}
                <strong>not a fixed-price lock-in</strong>: you keep full control of your service.
              </p>
              <p>
                Join the Co-op, we match you with a participating full-service company in your town, and they set you up
                at the negotiated rate. <strong>It&apos;s that easy.</strong>
              </p>
              <Link to="/signup" className="mkt-btn mkt-btn-primary">
                Join Citizen&apos;s Oil Co-op
              </Link>
            </div>
            <div className="mkt-stats">
              <div className="mkt-stat">
                <strong>3,000+</strong>
                <span>Members (approx.)</span>
              </div>
              <div className="mkt-stat">
                <strong>30+</strong>
                <span>Years negotiating for households</span>
              </div>
              <div className="mkt-stat">
                <strong>900</strong>
                <span>Example gallons / season for savings math</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section" style={{ background: "var(--color-bg-alt)" }} id="story">
        <div className="mkt-container mkt-prose" style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
          <h2 className="mkt-section-title">Our story</h2>
          <p>
            Founded in <strong>1981</strong> and incorporated in <strong>1992</strong>, Citizen&apos;s Oil Co-op is
            family-owned and has grown to <strong>over 3,000 members</strong> across every town in Connecticut and Rhode
            Island, plus parts of New York and Massachusetts. Same mission throughout:{" "}
            <strong>affordable, quality full-service energy</strong> and a real advocate for members.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-about" id="membership">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Membership</h2>
          <p className="mkt-section-sub">Fees, delivery, and referrals.</p>
          <div className="mkt-split">
            <div className="mkt-prose">
              <h3 className="mkt-subhead">Costs &amp; fees</h3>
              <ul>
                <li>
                  <strong>$10</strong> non-refundable application fee.
                </li>
                <li>
                  <strong>$35</strong> annual membership dues, renewing each year.
                </li>
                <li>
                  <strong>$25</strong> annual rate for seniors <strong>55+</strong> (also applies to some low-volume
                  propane accounts per Co-op policy).
                </li>
              </ul>
              <p className="mkt-callout mkt-callout--muted" style={{ marginTop: "1rem" }}>
                <strong>Online signup note:</strong> confirm current published fees with the office.
              </p>
              <h3 className="mkt-subhead">Delivery</h3>
              <p>
                Most suppliers use <strong>automatic delivery</strong>; some areas offer <strong>will-call</strong>. If
                you leave the Co-op, cancel delivery with your supplier and membership with the Co-op directly — we
                can&apos;t cancel for you.
              </p>
              <h3 className="mkt-subhead">Referral program</h3>
              <p>
                Refer <strong>five new active members</strong> and become a <strong>lifetime member</strong> with no
                annual dues.
              </p>
              <div className="mkt-callout" style={{ marginTop: "1rem" }}>
                <h3>The Next Step program</h3>
                <p>
                  Community groups can introduce the Co-op to their members — the Co-op donates <strong>$10</strong> per
                  new member back to the organization. (Can&apos;t be combined with the member referral program.)
                </p>
              </div>
            </div>
            <div>
              <div className="mkt-callout">
                <h3>We&apos;re on your side</h3>
                <p className="mkt-prose" style={{ margin: 0 }}>
                  Large membership means better contracts — and a voice when you need help with pricing or your supplier.
                </p>
              </div>
              <div className="mkt-pill-row">
                <span className="mkt-pill">Not a fixed-price lock-in</span>
                <span className="mkt-pill">Full-service suppliers</span>
                <span className="mkt-pill">Advocacy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="services">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Services</h2>
          <p className="mkt-section-sub">From heat to insurance — tap any program for details.</p>
          <ul className="mkt-services-grid" style={{ marginBottom: "2rem" }}>
            <a href="#services">Heating oil</a>
            <a href="#services">Heating oil prices</a>
            <a href="#services">Bioheat</a>
            <a href="#services">Propane</a>
            <a href="#services">Electricity</a>
            <span>Blue Earth Compost</span>
            <a href="#services">Energy audits</a>
            <a href="#services">Insurance</a>
            <a href="#services">Solar energy</a>
            <Link to="/signup">Join / renewal</Link>
          </ul>
          <div className="mkt-service-acc">
            <ServiceDetails title="Heating oil">
              <p>
                All Co-op heating oil suppliers are <strong>full-service</strong>. Members typically see pricing roughly{" "}
                <strong>40–50¢ below</strong> average state posted prices, with competitive <strong>service contracts</strong>{" "}
                and access to <strong>budget billing</strong> programs (often arranged before September 1).
              </p>
              <p>
                You&apos;re billed by your company with time to pay — and the Co-op can help advocate if you have
                service or pricing questions.
              </p>
            </ServiceDetails>
            <ServiceDetails title="Propane">
              <p>
                Discounted propane pricing; many members receive added benefits such as <strong>free tank rental</strong>
                . The Co-op forwards your information to a participating supplier, who contacts you, performs a safety
                check, switches equipment as needed, and coordinates removal of the old tank.
              </p>
              <p>
                Existing Co-op members can often <strong>add propane without a second membership fee</strong>. Many oil
                suppliers also deliver propane for stacked savings.
              </p>
            </ServiceDetails>
            <ServiceDetails title="Bioheat (B20)">
              <p>
                <strong>B20</strong> is 80% low-sulfur No. 2 oil and 20% biodiesel — usable in existing oil equipment.
                Biodiesel in the blend is sourced to meet <strong>ASTM</strong> standards (e.g. Greenleaf Biofuels).
              </p>
              <p>Environmental highlights often cited for B20 include:</p>
              <ul>
                <li>Meaningful reductions in CO₂, particulates, and other emissions vs. conventional oil.</li>
                <li>Supports domestic fuel production and reduced reliance on imported oil.</li>
              </ul>
              <p>
                Bioheat is available in many Connecticut towns; where it isn&apos;t, rallying interest (e.g. ~10
                neighbors) can help the Co-op open a route.
              </p>
            </ServiceDetails>
            <ServiceDetails title="Solar energy">
              <p>
                Solar can reduce purchased electricity with a fixed energy rate. Many households save a significant
                share vs. utility supply costs; federal (and sometimes state) incentives apply — ask for current
                programs.
              </p>
              <p>
                A Co-op representative can review your home and usage. Members who enroll through the Co-op have at times
                qualified for a <strong>$500</strong> incentive upon project completion and activation (verify current
                offer).
              </p>
            </ServiceDetails>
            <ServiceDetails title="Home energy audits (NESE)">
              <p>
                Partner <strong>New England Smart Energy (NESE)</strong> offers audits across Connecticut with a modest{" "}
                <strong>copay</strong> (often around <strong>$50</strong>), including substantial in-home measures (historically up to ~$600 of
                work) and access to rebates on follow-up improvements.
              </p>
              <p>Pairing audits with cleaner fuels like bioheat can cut both bills and carbon footprint.</p>
            </ServiceDetails>
            <ServiceDetails title="Insurance (Bearingstar)">
              <p>
                Partner <strong>Bearingstar Insurance</strong> offers member pricing on auto and homeowners coverage.
                Testimonials cite <strong>hundreds of dollars</strong> in annual savings vs. prior carriers.
              </p>
            </ServiceDetails>
            <ServiceDetails title="Electricity">
              <p>
                <strong>Status:</strong> The Co-op has previously offered electricity programs; as of recent updates,{" "}
                <strong>there may not be a live electric supply offer</strong> while a new supplier relationship is
                pursued. <strong>Call or email</strong> for the latest.
              </p>
            </ServiceDetails>
            <ServiceDetails title="Blue Earth Compost &amp; more">
              <p>
                The Co-op highlights additional member programs on{" "}
                <a href="https://oilco-op.com/" target="_blank" rel="noopener noreferrer">
                  oilco-op.com
                </a>{" "}
                — including organics/compost and other seasonal offers. This site focuses on core energy programs;
                visit the main site for the full menu.
              </p>
            </ServiceDetails>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="green" style={{ background: "var(--color-surface)" }}>
        <div className="mkt-container mkt-split">
          <div>
            <h2 className="mkt-section-title" style={{ textAlign: "left" }}>
              Going green
            </h2>
            <p className="mkt-prose">
              <strong>Bioheat</strong> lowers emissions from oil heat, <strong>energy audits</strong> pinpoint upgrades
              that pay back over time, and <strong>solar</strong> adds clean on-site generation. Ask the Co-op how
              current incentives fit your home.
            </p>
          </div>
          <div className="mkt-callout mkt-callout--muted">
            <h3>Simple. Affordable. Efficient.</h3>
            <p className="mkt-prose" style={{ margin: 0 }}>
              That&apos;s how the Co-op describes its mission: low prices for quality full-service energy, with a path
              toward cleaner options.
            </p>
          </div>
        </div>
      </section>

      <section className="mkt-quote">
        <div className="mkt-container">
          <p>
            <em>What do members think? Watch stories and updates on the Co-op&apos;s site.</em>
          </p>
          <a href="https://oilco-op.com/" className="mkt-video-cta" target="_blank" rel="noopener noreferrer">
            ▶ Member video &amp; news on oilco-op.com
          </a>
        </div>
      </section>

      <ValueBand />

      <section className="mkt-section" id="community">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Community &amp; partnerships</h2>
          <p className="mkt-section-sub">The Co-op gives back to local organizations, including:</p>
          <ul className="mkt-partners">
            <li>
              <strong>Roxbury Fuel Bank</strong>
              Give-back per new member for neighbors in need.
            </li>
            <li>
              <strong>West Hartford Youth Basketball (WHYBL)</strong>
              Team sponsorship and Next Step partner.
            </li>
            <li>
              <strong>Buena Vista Property Owners Assn.</strong>
              Neighborhood savings and fundraising.
            </li>
            <li>
              <strong>Connecticut Citizen Action Group</strong>
              Helped launch the Co-op; consumer-rights work.
            </li>
            <li>
              <strong>Friends of Fernridge Park</strong>
              Events and preservation in West Hartford.
            </li>
            <li>
              <strong>Our Lady of Calvary Retreat Center</strong>
              Multi-year golf fundraiser support.
            </li>
          </ul>
        </div>
      </section>

      <section className="mkt-section" style={{ background: "var(--color-bg-alt)" }} id="news">
        <div className="mkt-container mkt-prose" style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <h2 className="mkt-section-title">What&apos;s new</h2>
          <p>
            Expansion updates, seasonal referral promotions, lifetime-member campaigns, and event sponsorships are posted
            on the Co-op&apos;s blog and news pages.
          </p>
          <a href="https://oilco-op.com/" className="mkt-btn mkt-btn-primary" target="_blank" rel="noopener noreferrer">
            Read news on oilco-op.com
          </a>
        </div>
      </section>

      <section className="mkt-section mkt-about" id="contact">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Contact us</h2>
          <p className="mkt-section-sub">West Hartford, CT — we&apos;re here to help.</p>
          <div className="mkt-contact-grid">
            <div className="mkt-contact-item">
              <strong>Phone</strong>
              <br />
              <a href="tel:8605616011">860-561-6011</a>
            </div>
            <div className="mkt-contact-item">
              <strong>Email</strong>
              <br />
              <a href="mailto:hutson@oilco-op.com">hutson@oilco-op.com</a>
            </div>
            <div className="mkt-contact-item">
              <strong>Fax</strong>
              <br />
              860-561-9588
            </div>
            <div className="mkt-contact-item">
              <strong>Office</strong>
              <br />
              West Hartford, Connecticut
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-join" id="get-started">
        <div className="mkt-join-box">
          <h2>Get started</h2>
          <p>
            <strong>CALL TODAY</strong>{" "}
            <a href="tel:8605616011" className="mkt-phone">
              860-561-6011
            </a>
          </p>
          <p>Heating oil · Bioheat · Propane · Electric programs · Insurance · Audits · Solar</p>
          <div className="mkt-hero-actions" style={{ justifyContent: "center" }}>
            <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
              Join Citizen&apos;s Oil Co-op online
            </Link>
          </div>
          <p className="mkt-sync-note">Confirm current rates, fees, and offers with the office.</p>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------
   Reference-aligned professional sections
   ------------------------------------------------------------------ */

/**
 * Image placeholder slot, wired for real photography.
 * Pass `src` to render the real photo; otherwise a styled, labelled
 * placeholder shows so staff can see exactly where art goes.
 */
export function ImageSlot({
  src,
  alt,
  label,
  className = "",
}: {
  src?: string;
  alt: string;
  label: string;
  className?: string;
}) {
  if (src) {
    return <img src={src} alt={alt} className={`mkt-img ${className}`.trim()} />;
  }
  return (
    <div className={`mkt-img-slot ${className}`.trim()} role="img" aria-label={alt}>
      <span className="mkt-img-slot-icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.6" />
          <path d="M21 16l-5-5-6 6-3-3-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="mkt-img-slot-label">{label}</span>
    </div>
  );
}

/** Dark-green value-proposition band under the hero. */
export function ValueBand() {
  const values = [
    {
      title: "Competitive pricing",
      body: "We use the power of group buying to negotiate lower prices on your fuel.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Consumer education",
      body: "We share the knowledge and tools to help you make informed energy decisions.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6.5A2 2 0 0 1 5 5h5a2 2 0 0 1 2 2v12a1.5 1.5 0 0 0-1.5-1.5H3zM21 6.5A2 2 0 0 0 19 5h-5a2 2 0 0 0-2 2v12a1.5 1.5 0 0 1 1.5-1.5H21z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Consumer advocacy",
      body: "We work for you, not the fuel companies — always have, always will.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
          <path d="M16 6.2a3 3 0 0 1 0 5.6M18 3.6a6.5 6.5 0 0 1 3.5 8.4" strokeLinecap="round" />
        </svg>
      ),
    },
  ];
  return (
    <section className="mkt-valueband" aria-label="Why members join">
      <div className="mkt-valueband-inner">
        {values.map((v) => (
          <div className="mkt-value" key={v.title}>
            <span className="mkt-value-icon" aria-hidden>
              {v.icon}
            </span>
            <div>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Real savings — figure + retail-vs-member comparison + photo slot. */
export function SavingsSection() {
  return (
    <section className="mkt-section mkt-savings" id="savings">
      <div className="mkt-container">
        <div className="mkt-savings-grid">
          <div className="mkt-savings-lead">
            <p className="mkt-eyebrow" style={{ textAlign: "left" }}>
              Real savings, real results
            </p>
            <h2>The average member saves</h2>
            <span className="mkt-savings-figure">$250–$300</span>
            <p>
              per heating season on oil and propane — often <strong>40–60¢ per gallon</strong> below average posted
              prices, with no fixed-price lock-in.
            </p>
            <Link to="/signup" className="mkt-btn mkt-btn-primary">
              See member savings
            </Link>
          </div>

          <div className="mkt-compare" role="img" aria-label="Retail prices versus negotiated Co-op prices">
            <div className="mkt-compare-col">
              <h4>Without membership</h4>
              <div className="mkt-bars" aria-hidden>
                <span className="mkt-bar mkt-bar-a" />
                <span className="mkt-bar mkt-bar-b" />
                <span className="mkt-bar mkt-bar-c" />
              </div>
              <span className="mkt-compare-price">$$$</span>
              <span className="mkt-compare-note">Retail prices — you pay more.</span>
            </div>
            <div className="mkt-compare-col mkt-compare-col--you">
              <h4>With Co-op membership</h4>
              <div className="mkt-bars" aria-hidden>
                <span className="mkt-bar mkt-bar-x" />
                <span className="mkt-bar mkt-bar-y" />
                <span className="mkt-bar mkt-bar-z" />
              </div>
              <span className="mkt-compare-price">$$</span>
              <span className="mkt-compare-note">Negotiated prices — you save more.</span>
            </div>
          </div>

          <ImageSlot
            src="/site/family.jpg"
            alt="A local family outside their home in winter"
            label="Photo: a member family at home in winter"
            className="mkt-img-slot--tall"
          />
        </div>
      </div>
    </section>
  );
}

/** Feature row — "Why thousands choose Citizen's Oil Co-op". */
export function WhyChooseSection() {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;
  const features = [
    {
      title: "40+ years",
      body: "Serving the region since the early 1980s.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M12 3l7 3v5c0 4.4-2.9 8-7 9-4.1-1-7-4.6-7-9V6z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Local & trusted",
      body: "We partner with reputable full-service companies.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M4 11l8-6 8 6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10v9h12v-9" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Full-service",
      body: "Automatic delivery, expert service & 24/7 support.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M2 7h11v8H2zM13 10h4l3 3v2h-7z" strokeLinejoin="round" />
          <circle cx="6" cy="17" r="1.6" />
          <circle cx="17" cy="17" r="1.6" />
        </svg>
      ),
    },
    {
      title: "Budget plans",
      body: "Affordable monthly payment options.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.4" />
        </svg>
      ),
    },
    {
      title: "24/7 emergency",
      body: "You're never alone — help is always a call away.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Service contracts",
      body: "Protection for your heating system.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M6 3h9l3 3v15H6z" strokeLinejoin="round" />
          <path d="M9 11h6M9 15h6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "Local business",
      body: "A community company, here for our neighbors.",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M12 21c5-3.5 7.5-7 7.5-10.5A7.5 7.5 0 0 0 12 3a7.5 7.5 0 0 0-7.5 7.5C4.5 14 7 17.5 12 21z" strokeLinejoin="round" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
      ),
    },
  ];
  return (
    <section className="mkt-section mkt-why" id="why">
      <div className="mkt-container">
        <p className="mkt-eyebrow">Why members stay</p>
        <h2 className="mkt-section-title">Why thousands choose Citizen&apos;s Oil Co-op</h2>
        <div className="mkt-rule" aria-hidden />
        <div className="mkt-why-grid">
          {features.map((f) => (
            <div className="mkt-why-item" key={f.title}>
              <span className="mkt-why-icon" aria-hidden>
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Star rating (five filled). */
function Stars() {
  return (
    <span className="mkt-stars" aria-label="Five out of five stars">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16.9 5.9 19.4 7.4 12.9l-5-4.3 6.6-.6z" />
        </svg>
      ))}
    </span>
  );
}

/** Three member testimonials with star ratings. */
export function TestimonialsBand() {
  const quotes = [
    {
      text: "We saved several hundred dollars last winter and didn't have to sacrifice service. Joining was the best decision.",
      name: "Karen R.",
      meta: "Glastonbury, CT · Heating oil",
    },
    {
      text: "The pricing is consistently better than what I was paying before, and the customer service is always excellent.",
      name: "Mike D.",
      meta: "Southington, CT · Propane",
    },
    {
      text: "I love that they look out for consumers. It's more than just fuel savings — it's peace of mind.",
      name: "Lisa M.",
      meta: "Madison, CT · Heating oil",
    },
  ];
  return (
    <section className="mkt-section" id="testimonials">
      <div className="mkt-container">
        <p className="mkt-eyebrow">In their words</p>
        <h2 className="mkt-section-title">What our members are saying</h2>
        <div className="mkt-rule" aria-hidden />
        <div className="mkt-testimonials">
          {quotes.map((q) => (
            <figure className="mkt-quote-card" key={q.name}>
              <Stars />
              <blockquote>&ldquo;{q.text}&rdquo;</blockquote>
              <cite>
                <strong>{q.name}</strong>
                {q.meta}
              </cite>
            </figure>
          ))}
        </div>
        <p className="mkt-sync-note" style={{ textAlign: "center", marginTop: "1.5rem" }}>
          Representative member sentiment — see more stories on oilco-op.com.
        </p>
      </div>
    </section>
  );
}

/** Closing call-to-action band over a photo slot. */
export function FinalCtaBand() {
  return (
    <section className="mkt-finalcta" id="join">
      <div className="mkt-finalcta-bg" aria-hidden>
        <ImageSlot src="/site/house.jpg" alt="" label="Photo: a warm, lit home on a winter evening" />
      </div>
      <div className="mkt-finalcta-inner">
        <h2>Ready to start saving?</h2>
        <p>Join the region&apos;s trusted home-heating buyers&apos; club today.</p>
        <div className="mkt-finalcta-actions">
          <Link to="/signup" className="mkt-btn mkt-btn-lg mkt-btn-on-accent">
            Become a member today
          </Link>
          <a href="tel:8605616011" className="mkt-finalcta-phone">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            860-561-6011
          </a>
        </div>
        <p className="mkt-finalcta-check">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Join in minutes. Start saving all season long.
        </p>
      </div>
    </section>
  );
}
