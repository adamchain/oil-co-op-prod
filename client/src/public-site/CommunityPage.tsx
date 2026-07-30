import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Partner = {
  _id: string;
  name: string;
  shortName?: string;
  blurb?: string;
  websiteUrl?: string;
  imageUrl?: string;
  logoUrl?: string;
};

type CommunityEvent = {
  _id: string;
  title: string;
  eventDate?: string;
  location?: string;
  blurb?: string;
  imageUrl?: string;
  kind: "upcoming" | "recent";
};

function formatEventDate(iso?: string): { month: string; day: string; full: string } {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { month: "—", day: "", full: "" };
  }
  const d = new Date(`${iso}T12:00:00`);
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate());
  const full = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return { month, day, full };
}

/** Community Partnerships — Next Step, partners grid, become-a-partner, events. */
export default function CommunityPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [upcoming, setUpcoming] = useState<CommunityEvent[]>([]);
  const [recent, setRecent] = useState<CommunityEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<{ partners: Partner[] }>("/api/community/partners"),
      api<{ upcoming: CommunityEvent[]; recent: CommunityEvent[] }>("/api/community/events"),
    ])
      .then(([p, e]) => {
        if (cancelled) return;
        setPartners(p.partners || []);
        setUpcoming(e.upcoming || []);
        setRecent(e.recent || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load community content");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mkt-community-page">
      <section className="mkt-comm-hero">
        <img src="/site/house.jpg" alt="" className="mkt-comm-hero-img" />
        <div className="mkt-comm-hero-scrim" aria-hidden />
        <div className="mkt-container mkt-comm-hero-copy">
          <h1>Community Partnerships</h1>
          <p>
            Building strong communities through partnerships that help members save — and give back to the organizations
            they care about.
          </p>
        </div>
      </section>

      <section className="mkt-comm-next">
        <div className="mkt-container">
          <div className="mkt-comm-next-card">
            <div className="mkt-comm-next-copy">
              <span className="mkt-comm-icon-badge" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
                </svg>
              </span>
              <h2>The Next Step Program</h2>
              <p className="mkt-comm-kicker">Helping our members give back from day one.</p>
              <p>
                For every new member, the Co-op donates <strong>$10</strong> to a Community Partner of the member&apos;s
                choice — at no additional cost to you. Register an approved organization, church, nonprofit, or group and
                watch support add up as friends and neighbors join.
              </p>
              <p>
                Payments are made bi-annually when they exceed $50 per period. Next Step cannot be combined with the
                member referral program on the same signup.
              </p>
            </div>
            <div className="mkt-comm-next-aside" aria-hidden>
              <div className="mkt-comm-heart-art">
                <svg viewBox="0 0 120 120" fill="none">
                  <circle cx="60" cy="60" r="54" fill="rgba(14,118,60,0.08)" />
                  <path
                    d="M60 92s-28-18-28-40a16 16 0 0 1 28-10 16 16 0 0 1 28 10c0 22-28 40-28 40z"
                    fill="var(--color-accent)"
                    opacity="0.9"
                  />
                </svg>
              </div>
            </div>
          </div>
          <p className="mkt-comm-next-footer">
            Every new member has the opportunity to support one of our Community Partners at no additional cost.
          </p>
        </div>
      </section>

      <section className="mkt-comm-partners" id="partners">
        <div className="mkt-container">
          <header className="mkt-comm-section-head">
            <h2>Our Community Partners</h2>
            <p>Organizations we work with through Next Step and local sponsorships. The list keeps growing.</p>
          </header>

          {error && <p className="mkt-error">{error}</p>}

          <div className="mkt-comm-partner-grid">
            {partners.map((p) => (
              <article key={p._id} className="mkt-comm-partner-card">
                <div className="mkt-comm-partner-photo">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" />
                  ) : (
                    <div className="mkt-comm-partner-photo-fallback" />
                  )}
                </div>
                <div className="mkt-comm-partner-body">
                  {p.logoUrl ? <img src={p.logoUrl} alt="" className="mkt-comm-partner-logo" /> : null}
                  <h3>{p.shortName || p.name}</h3>
                  {p.shortName && p.shortName !== p.name ? (
                    <p className="mkt-comm-partner-fullname">{p.name}</p>
                  ) : null}
                  {p.blurb ? <p className="mkt-comm-partner-blurb">{p.blurb}</p> : null}
                  {p.websiteUrl ? (
                    <a
                      href={p.websiteUrl}
                      className="mkt-btn mkt-btn-ghost mkt-comm-visit"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit website
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M14 5h5v5M19 5l-9 9M10 5H5v14h14v-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-comm-become">
        <div className="mkt-container mkt-comm-become-inner">
          <div>
            <span className="mkt-comm-icon-badge" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 14c-3 1-5 3-5 5v1h10v-1c0-2-2-4-5-5M16 14c3 1 5 3 5 5v1M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17.5 10a2.5 2.5 0 1 0 0-5" strokeLinecap="round" />
              </svg>
            </span>
            <h2>Become a Community Partner</h2>
            <p>
              We partner with nonprofits, schools, unions, churches, and local groups that want to raise funds while
              helping their members save on home energy. If your organization is a good fit, we&apos;d love to talk.
            </p>
          </div>
          <div className="mkt-comm-become-cta">
            <h3>Interested in becoming a Community Partner?</h3>
            <a href="mailto:hutson@oilco-op.com" className="mkt-btn mkt-btn-primary mkt-btn-lg">
              Contact us
            </a>
            <p className="mkt-comm-become-phone">
              or call <a href="tel:8605616011">860-561-6011</a>
            </p>
          </div>
        </div>
      </section>

      <section className="mkt-comm-events" id="events">
        <div className="mkt-container">
          <header className="mkt-comm-section-head">
            <h2>Community Events</h2>
            <p>Highlights from events we&apos;re participating in — past and upcoming.</p>
          </header>

          <div className="mkt-comm-events-grid">
            <div>
              <h3 className="mkt-comm-events-col-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                </svg>
                Upcoming events
              </h3>
              <ul className="mkt-comm-event-list">
                {upcoming.map((ev) => {
                  const d = formatEventDate(ev.eventDate);
                  return (
                    <li key={ev._id} className="mkt-comm-event-upcoming">
                      <div className="mkt-comm-event-dateblock" aria-hidden>
                        <span>{d.month}</span>
                        <strong>{d.day || "—"}</strong>
                      </div>
                      <div>
                        <h4>{ev.title}</h4>
                        <p>
                          {[d.full, ev.location].filter(Boolean).join(" · ")}
                        </p>
                        {ev.blurb ? <p className="mkt-comm-event-blurb">{ev.blurb}</p> : null}
                      </div>
                    </li>
                  );
                })}
                {upcoming.length === 0 && <li className="mkt-comm-event-empty">No upcoming events posted yet.</li>}
              </ul>
            </div>

            <div>
              <h3 className="mkt-comm-events-col-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="9" cy="8" r="3" />
                  <circle cx="16" cy="9" r="2.5" />
                  <path d="M3 19c1-3 3.5-5 6-5s5 2 6 5M13 19c.5-2 2-3.5 4.5-3.5" strokeLinecap="round" />
                </svg>
                Recent events
              </h3>
              <ul className="mkt-comm-event-list">
                {recent.map((ev) => {
                  const d = formatEventDate(ev.eventDate);
                  return (
                    <li key={ev._id} className="mkt-comm-event-recent">
                      <div className="mkt-comm-event-thumb">
                        {ev.imageUrl ? <img src={ev.imageUrl} alt="" /> : <div className="mkt-comm-partner-photo-fallback" />}
                      </div>
                      <div>
                        <h4>{ev.title}</h4>
                        <p>{[d.full, ev.location].filter(Boolean).join(" · ")}</p>
                        {ev.blurb ? <p className="mkt-comm-event-blurb">{ev.blurb}</p> : null}
                      </div>
                    </li>
                  );
                })}
                {recent.length === 0 && <li className="mkt-comm-event-empty">No recent events posted yet.</li>}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-comm-thanks">
        <div className="mkt-container mkt-comm-thanks-inner">
          <div>
            <p className="mkt-comm-thanks-brand">Better together</p>
            <p>Building stronger communities — one membership at a time.</p>
          </div>
          <div className="mkt-comm-thanks-actions">
            <p>Thank you for being part of the Citizen&apos;s Oil Co-op family.</p>
            <Link to="/signup" className="mkt-btn mkt-btn-on-accent">
              Become a member
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
