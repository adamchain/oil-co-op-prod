import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Citizen's Oil Co-op public marketing homepage.
 * Content aligned with oilco-op.com and org materials; fees/partners may change — verify with staff.
 */

const slides = [
  {
    tag: "Heating oil",
    title: "Start saving on heating oil",
    desc: "Full-service heating oil at negotiated rates — we match you with a participating company in your area.",
    cta: "Join the Co-op",
    href: "/signup",
  },
  {
    tag: "Electric",
    title: "A great electric choice at competitive pricing",
    desc: "We're working to bring members a new electricity offer. See the services section for the latest status.",
    cta: "Read about electricity",
    href: "#services",
  },
  {
    tag: "Refer a friend",
    title: "Refer a friend and save even more",
    desc: "Refer five active members for lifetime membership with no annual dues. Individual referrals can earn seasonal rewards.",
    cta: "Referral program",
    href: "#membership",
  },
  {
    tag: "Propane",
    title: "Reliable propane for less",
    desc: "Discounted propane pricing — often with perks like free tank rental. We connect you with a local participating supplier.",
    cta: "Explore propane",
    href: "#services",
  },
  {
    tag: "Solar",
    title: "Join the solar revolution",
    desc: "Lock in savings on electricity with solar. Members who sign through the Co-op may qualify for a completion incentive.",
    cta: "Learn about solar",
    href: "#services",
  },
  {
    tag: "Community",
    title: "Power in numbers",
    desc: "Our membership helps negotiate lower prices and gives us a voice when you need an advocate with your energy company.",
    cta: "Community & Next Step",
    href: "#community",
  },
];

function ServiceDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details>
      <summary>{title}</summary>
      <div className="mkt-acc-body mkt-prose">{children}</div>
    </details>
  );
}

export default function PublicHomePage() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, []);

  const s = slides[i];

  return (
    <>
      <section className="mkt-hero">
        <div className="mkt-hero-bg" aria-hidden />
        <div className="mkt-hero-inner">
          <p className="mkt-hero-tag">{s.tag}</p>
          <h1>{s.title}</h1>
          <p>{s.desc}</p>
          <div className="mkt-hero-actions">
            {s.href.startsWith("#") ? (
              <a href={s.href} className="mkt-btn mkt-btn-primary">
                {s.cta}
              </a>
            ) : (
              <Link to={s.href} className="mkt-btn mkt-btn-primary">
                {s.cta}
              </Link>
            )}
            <a href="tel:8605616011" className="mkt-btn mkt-btn-ghost">
              860-561-6011
            </a>
          </div>
          <div className="mkt-slide-dots">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={idx === i ? "active" : ""}
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setI(idx)}
              />
            ))}
          </div>
          <div className="mkt-anchor-list" aria-label="On this page">
            <a href="/#about">About</a>
            <a href="/#membership">Membership</a>
            <a href="/#services">Services</a>
            <a href="/#green">Going green</a>
            <a href="/#community">Community</a>
            <a href="/#contact">Contact</a>
          </div>
        </div>
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
      </section>

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
                Through group purchasing, many members save on the order of <strong>$250–$300 per heating season</strong>
                . The Co-op has published examples of roughly <strong>$500 per heating season</strong> vs. Connecticut
                state averages for full-service oil at <strong>~900 gallons</strong>. Pricing is often roughly{" "}
                <strong>40–60¢ per gallon</strong> below average posted prices, with total annual savings depending on
                usage and market conditions.
              </p>
              <p>
                You join the Co-op, we identify a participating full-service company that fits your town and needs, and
                that company contacts you to set up service at the Co-op&apos;s negotiated rate.{" "}
                <strong>It&apos;s that easy.</strong>
              </p>
              <p>
                Membership is <strong>not a lock-in contract</strong> for a fixed price — you keep control of your
                service once you&apos;re set up with a supplier. Variable pricing has helped many families save in recent
                markets.
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
        <div className="mkt-container mkt-prose" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <h2 className="mkt-section-title">Our story</h2>
          <p>
            The Co-op began in <strong>1981</strong> in connection with a non-profit; when that organization wound down,
            the founders continued the mission of fair pricing for Connecticut residents.{" "}
            <strong>Citizen&apos;s Oil Co-op was incorporated in June 1992</strong> to unite heating oil consumers and
            leverage purchasing power.
          </p>
          <p>
            Family-owned and operated, the Co-op has grown to <strong>over 3,000 members</strong> across{" "}
            <strong>every town in Connecticut and Rhode Island</strong>, with expansion into parts of{" "}
            <strong>New York and Massachusetts</strong> (including much of Worcester, Norfolk, and Bristol counties in
            MA and <strong>Westchester County, NY</strong>).
          </p>
          <p>
            Today the Co-op also negotiates programs beyond oil — propane, bioheat, solar, audits, insurance, and more —
            with the same focus: <strong>affordable, quality full-service energy</strong> and advocacy for members.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-steps" id="how">
        <div className="mkt-container">
          <h2 className="mkt-section-title">How does this work?</h2>
          <p className="mkt-section-sub">Three steps — same model featured on oilco-op.com.</p>
          <ul className="mkt-steps-list">
            <li className="mkt-step">
              <span className="mkt-step-num">1</span>
              <h3>Join Citizen&apos;s Oil Co-op</h3>
              <p>Apply online or call the office. Pay the application fee and annual membership (see fees below).</p>
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
        </div>
      </section>

      <section className="mkt-section mkt-about" id="membership">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Membership</h2>
          <p className="mkt-section-sub">Fees, delivery, referrals, and what membership does not mean.</p>
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
                <strong>Online signup note:</strong> If you join through this app, charged amounts may follow your
                configured payment system — confirm current published fees with the office.
              </p>
              <h3 className="mkt-subhead">Delivery</h3>
              <p>
                Most participating companies use <strong>automatic delivery</strong>. Some areas may allow{" "}
                <strong>will-call</strong> (you schedule with a few days&apos; notice) — ask the Co-op what&apos;s
                available where you live.
              </p>
              <p>
                If you leave the Co-op, you must <strong>end delivery arrangements with your oil or propane company</strong>{" "}
                directly; the Co-op cannot cancel for you. You must also <strong>cancel membership</strong> with the Co-op
                to stop renewals.
              </p>
              <h3 className="mkt-subhead">Referral program</h3>
              <p>
                Refer <strong>five new active members</strong> and become a <strong>lifetime member</strong> with{" "}
                <strong>no annual dues</strong>. Individual referrals may qualify for waived dues in an upcoming season
                or promotional raffles (e.g. gift cards) when announced.
              </p>
              <div className="mkt-callout" style={{ marginTop: "1rem" }}>
                <h3>The Next Step program</h3>
                <p>
                  Nonprofits and community groups can introduce the Co-op to their members. For each person who joins,
                  the Co-op donates <strong>$10</strong> back to that organization (paid bi-annually when totals exceed
                  $50 per period, otherwise carried forward).{" "}
                  <strong>Next Step and the member referral program cannot be combined</strong> on the same signup.
                </p>
              </div>
            </div>
            <div>
              <div className="mkt-callout">
                <h3>We&apos;re on your side</h3>
                <p className="mkt-prose" style={{ margin: 0 }}>
                  Large membership means better contracts — and a voice when you need help with pricing, service
                  contracts, or supplier issues.
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
          <p className="mkt-section-sub">Heat to insurance — details condensed from the Co-op&apos;s public materials.</p>
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
              <strong>Bioheat</strong> lowers emissions from oil heat. <strong>Home energy audits</strong> pinpoint
              insulation and equipment upgrades that pay back over time. Together they reduce your carbon footprint
              while keeping costs in check.
            </p>
            <p className="mkt-prose">
              <strong>Solar</strong> adds on-site clean generation. Ask the Co-op how current incentives align with your
              roof and usage.
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
          <a
            href="https://oilco-op.com/"
            className="mkt-video-cta"
            target="_blank"
            rel="noopener noreferrer"
          >
            ▶ Member video &amp; news on oilco-op.com
          </a>
        </div>
      </section>

      <section className="mkt-section" id="community">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Community &amp; partnerships</h2>
          <p className="mkt-section-sub">
            The Co-op donates and sponsors local organizations — examples from public materials include:
          </p>
          <ul className="mkt-partners">
            <li>
              <strong>Roxbury Fuel Bank</strong>
              Give-back per new member to support neighbors in need.
            </li>
            <li>
              <strong>West Hartford Youth Basketball League (WHYBL)</strong>
              Long-running team sponsorship and Next Step participation.
            </li>
            <li>
              <strong>Buena Vista Property Owners Association</strong>
              Neighborhood partnership for savings and fundraising.
            </li>
            <li>
              <strong>Connecticut Citizen Action Group (CCAG)</strong>
              Historic ties — CCAG helped launch the Co-op; ongoing consumer-rights work.
            </li>
            <li>
              <strong>Friends of Fernridge Park</strong>
              Events and preservation in West Hartford.
            </li>
            <li>
              <strong>Our Lady of Calvary Retreat Center</strong>
              Golf fundraiser support and donations over multiple years.
            </li>
          </ul>

          <h3 className="mkt-section-title" style={{ marginTop: "2.5rem", fontSize: "1.35rem" }}>
            Member voices
          </h3>
          <div className="mkt-testimonials">
            <figure className="mkt-quote-card">
              <blockquote>
                &ldquo;The reduced per-gallon cost helps our household budget — we keep telling friends about the
                program.&rdquo;
              </blockquote>
              <cite>
                Mark &amp; Alison Laucella, Middletown · members since 2007
              </cite>
            </figure>
            <figure className="mkt-quote-card">
              <blockquote>
                &ldquo;A longtime member and advocate — the Co-op celebrated her 100th birthday with lifetime membership
                and a dues refund as a thank-you.&rdquo;
              </blockquote>
              <cite>Clara K., Rocky Hill · member since 2006</cite>
            </figure>
            <figure className="mkt-quote-card">
              <blockquote>
                &ldquo;Switching home and auto insurance through the Co-op Bearingstar program saved hundreds compared
                to our old carrier.&rdquo;
              </blockquote>
              <cite>Member testimonial (insurance)</cite>
            </figure>
          </div>
        </div>
      </section>

      <section className="mkt-section" style={{ background: "var(--color-bg-alt)" }} id="news">
        <div className="mkt-container mkt-prose" style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <h2 className="mkt-section-title">What&apos;s new</h2>
          <p>
            Expansion updates, seasonal referral promotions, lifetime-member campaigns, and event sponsorships are posted
            on the Co-op&apos;s blog and news pages.
          </p>
          <a
            href="https://oilco-op.com/"
            className="mkt-btn mkt-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
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

      <section className="mkt-join">
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
          <p className="mkt-sync-note">
            This modern member portal connects to your organization&apos;s admin system (members, oil company assignment,
            June billing, referrals, and reports). Public copy mirrors themes from{" "}
            <a href="https://oilco-op.com/">oilco-op.com</a>; always confirm rates, fees, and offers with staff.
          </p>
        </div>
      </section>
    </>
  );
}
