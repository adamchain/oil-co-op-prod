import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../authContext";
import { useSiteText } from "../public-site/content/SiteContentContext";
import type { ContentGroup } from "../public-site/content/types";

export const LAYOUT_CONTENT: ContentGroup = {
  page: "layout",
  title: "Header & Footer",
  fields: [
    { key: "layout.navHow", label: "Nav: How it works", value: "How it works" },
    { key: "layout.navServices", label: "Nav: Services", value: "Services" },
    { key: "layout.navSavings", label: "Nav: Savings", value: "Savings" },
    { key: "layout.navFaq", label: "Nav: FAQ", value: "FAQ" },
    { key: "layout.navCommunity", label: "Nav: Community Partnerships", value: "Community Partnerships" },
    { key: "layout.navPhone", label: "Nav phone number", value: "860-561-6011" },
    { key: "layout.navSignIn", label: "Nav: Member sign in", value: "Member sign in" },
    { key: "layout.navJoin", label: "Nav: Join Now button", value: "Join Now" },
    { key: "layout.navSignOut", label: "Nav: Sign out button", value: "Sign out" },
    { key: "layout.navAccount", label: "Nav: My account button", value: "My account" },
    { key: "layout.footerServices", label: "Footer: Services", value: "Services" },
    { key: "layout.footerCommunity", label: "Footer: Community Partnerships", value: "Community Partnerships" },
    { key: "layout.footerReferral", label: "Footer: Referral program", value: "Referral program" },
    { key: "layout.footerFaq", label: "Footer: FAQ", value: "FAQ" },
    { key: "layout.footerHeatingPrices", label: "Footer: Heating prices", value: "Heating prices" },
    { key: "layout.footerLinks", label: "Footer: Related links", value: "Related links" },
    { key: "layout.footerOurStory", label: "Footer: Our story", value: "Our story" },
    { key: "layout.footerTeam", label: "Footer: Meet our team", value: "Meet our team" },
    { key: "layout.footerTestimonials", label: "Footer: Testimonials", value: "Testimonials" },
    { key: "layout.footerEmail", label: "Footer email", value: "hutson@oilco-op.com" },
    { key: "layout.footerPhone", label: "Footer phone", value: "860-561-6011" },
    { key: "layout.footerFax", label: "Footer fax", value: "Fax 860-561-9588" },
    { key: "layout.footerAdmin", label: "Footer: Admin", value: "Admin" },
    { key: "layout.footerJoin", label: "Footer: Join Now", value: "Join Now" },
    { key: "layout.footerSignIn", label: "Footer: Sign in", value: "Sign in" },
    { key: "layout.footerAccount", label: "Footer: My account", value: "My account" },
    { key: "layout.footerSiteLink", label: "Footer: oilco-op.com link", value: "oilco-op.com" },
    { key: "layout.referTitle", label: "Refer a member heading", value: "Refer a member" },
    {
      key: "layout.referLead",
      label: "Refer a member lead",
      value: "Send us a referral and we will follow up directly.",
      multiline: true,
    },
    { key: "layout.referYourName", label: "Refer: your-name placeholder", value: "Your name" },
    { key: "layout.referYourEmail", label: "Refer: your-email placeholder", value: "Your email" },
    { key: "layout.referFriendName", label: "Refer: friend-name placeholder", value: "Friend's name" },
    { key: "layout.referFriendEmail", label: "Refer: friend-email placeholder", value: "Friend's email" },
    { key: "layout.referSubmit", label: "Refer: submit button", value: "Send referral" },
    {
      key: "layout.copyright1",
      label: "Copyright (before oilco-op.com link)",
      value:
        " Citizen's Oil Co-op Inc. · West Hartford, CT · Public content reflects themes from ",
      multiline: true,
    },
    {
      key: "layout.copyright2",
      label: "Copyright (after oilco-op.com link)",
      value:
        "; confirm fees and offers with the office. Member tools sync with the internal admin system.",
      multiline: true,
    },
  ],
};

export default function MarketingLayout() {
  const t = useSiteText();
  const { member, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<string>(window.location.hash || "#about");
  const [referrerName, setReferrerName] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const logoSrc = "/coop-logo.png";

  const close = () => setNavOpen(false);
  useEffect(() => {
    const onHash = () => setActiveHash(window.location.hash || "#about");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setHash = (hash: string) => {
    setActiveHash(hash);
    close();
  };

  const navActive = (path: string) => (location.pathname === path ? "active" : undefined);

  return (
    <div className="marketing-site">
      <header className="mkt-header">
        <div className="mkt-header-inner">
          <Link to="/" className="mkt-logo" onClick={close}>
            <img src={logoSrc} alt="Oil Co-op logo" className="mkt-logo-image" />
          </Link>
          <button
            type="button"
            className="mkt-nav-toggle"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav className={`mkt-nav ${navOpen ? "is-open" : ""}`}>
            <a href="/#how" className={activeHash === "#how" ? "active" : ""} onClick={() => setHash("#how")}>
              {t("layout.navHow")}
            </a>
            <Link to="/services" className={navActive("/services")} onClick={close}>
              {t("layout.navServices")}
            </Link>
            <a
              href="/#savings"
              className={activeHash === "#savings" ? "active" : ""}
              onClick={() => setHash("#savings")}
            >
              {t("layout.navSavings")}
            </a>
            <Link to="/faq" className={navActive("/faq")} onClick={close}>
              {t("layout.navFaq")}
            </Link>
            <Link to="/community" className={navActive("/community")} onClick={close}>
              {t("layout.navCommunity")}
            </Link>
            <a href="tel:8605616011" className="mkt-nav-phone" onClick={close}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("layout.navPhone")}
            </a>
            {!member ? (
              <>
                <Link to="/login" onClick={close}>
                  {t("layout.navSignIn")}
                </Link>
                <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-nav-btn" onClick={close}>
                  {t("layout.navJoin")}
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-ghost mkt-nav-btn"
                  onClick={() => {
                    logout();
                    close();
                  }}
                >
                  {t("layout.navSignOut")}
                </button>
                <Link to="/account" className="mkt-btn mkt-btn-primary mkt-nav-btn" onClick={close}>
                  {t("layout.navAccount")}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="mkt-main">
        <Outlet />
      </div>
      <footer className="mkt-footer">
        <div className="mkt-footer-inner">
          <div className="mkt-footer-top">
            <Link to="/" className="mkt-logo" style={{ color: "#fff" }} onClick={close}>
              <img src={logoSrc} alt="Oil Co-op logo" className="mkt-logo-image mkt-logo-image-footer" />
            </Link>
            <div className="mkt-footer-nav">
              <Link to="/services" onClick={close}>
                {t("layout.footerServices")}
              </Link>
              <Link to="/community" onClick={close}>
                {t("layout.footerCommunity")}
              </Link>
              <Link to="/referral" onClick={close}>
                {t("layout.footerReferral")}
              </Link>
              <Link to="/faq" onClick={close}>
                {t("layout.footerFaq")}
              </Link>
              <Link to="/heating-prices" onClick={close}>
                {t("layout.footerHeatingPrices")}
              </Link>
              <Link to="/links" onClick={close}>
                {t("layout.footerLinks")}
              </Link>
              <Link to="/our-story" onClick={close}>
                {t("layout.footerOurStory")}
              </Link>
              <Link to="/team" onClick={close}>
                {t("layout.footerTeam")}
              </Link>
              <Link to="/testimonials" onClick={close}>
                {t("layout.footerTestimonials")}
              </Link>
              <a href="mailto:hutson@oilco-op.com">{t("layout.footerEmail")}</a>
              <a href="tel:8605616011">{t("layout.footerPhone")}</a>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem" }}>{t("layout.footerFax")}</span>
              <a href="/login?next=%2Fadmin" target="_blank" rel="noopener noreferrer" onClick={close}>
                {t("layout.footerAdmin")}
              </a>
              {!member ? (
                <>
                  <Link to="/signup" onClick={close}>
                    {t("layout.footerJoin")}
                  </Link>
                  <Link to="/login" onClick={close}>
                    {t("layout.footerSignIn")}
                  </Link>
                </>
              ) : (
                <Link to="/account" onClick={close}>
                  {t("layout.footerAccount")}
                </Link>
              )}
              <a href="https://oilco-op.com/" target="_blank" rel="noopener noreferrer">
                {t("layout.footerSiteLink")}
              </a>
            </div>
          </div>
          <div className="mkt-footer-refer">
            <h3>{t("layout.referTitle")}</h3>
            <p>{t("layout.referLead")}</p>
            <form
              className="mkt-refer-form"
              action="mailto:hutson@oilco-op.com"
              method="post"
              encType="text/plain"
            >
              <input
                type="text"
                name="referrer_name"
                placeholder={t("layout.referYourName")}
                value={referrerName}
                onChange={(e) => setReferrerName(e.target.value)}
                required
              />
              <input
                type="email"
                name="referrer_email"
                placeholder={t("layout.referYourEmail")}
                value={referrerEmail}
                onChange={(e) => setReferrerEmail(e.target.value)}
                required
              />
              <input
                type="text"
                name="friend_name"
                placeholder={t("layout.referFriendName")}
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                required
              />
              <input
                type="email"
                name="friend_email"
                placeholder={t("layout.referFriendEmail")}
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                required
              />
              <button type="submit" className="mkt-btn mkt-btn-primary">
                {t("layout.referSubmit")}
              </button>
            </form>
          </div>
          <p className="mkt-footer-copy">
            © {new Date().getFullYear()}
            {t("layout.copyright1")}
            <a href="https://oilco-op.com/" style={{ color: "rgba(255,255,255,0.65)" }}>
              {t("layout.footerSiteLink")}
            </a>
            {t("layout.copyright2")}
          </p>
        </div>
      </footer>
    </div>
  );
}
