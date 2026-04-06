import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../authContext";

export default function MarketingLayout() {
  const { member, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<string>(window.location.hash || "#about");
  const [referrerName, setReferrerName] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const logoSrc = "/logo.png";

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
            <a href="/#about" className={activeHash === "#about" ? "active" : ""} onClick={() => setHash("#about")}>
              About
            </a>
            <a href="/#story" className={activeHash === "#story" ? "active" : ""} onClick={() => setHash("#story")}>
              Our story
            </a>
            <a href="/#how" className={activeHash === "#how" ? "active" : ""} onClick={() => setHash("#how")}>
              How it works
            </a>
            <a
              href="/#membership"
              className={activeHash === "#membership" ? "active" : ""}
              onClick={() => setHash("#membership")}
            >
              Membership
            </a>
            <a
              href="/#services"
              className={activeHash === "#services" ? "active" : ""}
              onClick={() => setHash("#services")}
            >
              Services
            </a>
            <a href="/#green" className={activeHash === "#green" ? "active" : ""} onClick={() => setHash("#green")}>
              Going green
            </a>
            <a
              href="/#community"
              className={activeHash === "#community" ? "active" : ""}
              onClick={() => setHash("#community")}
            >
              Community
            </a>
            <a
              href="/#contact"
              className={activeHash === "#contact" ? "active" : ""}
              onClick={() => setHash("#contact")}
            >
              Contact
            </a>
            {!member ? (
              <>
                <Link to="/signup" className="mkt-nav-cta" onClick={close}>
                  Join the Co-op
                </Link>
                <Link to="/login" onClick={close}>
                  Member sign in
                </Link>
              </>
            ) : (
              <>
                <Link to="/account" className="mkt-nav-cta" onClick={close}>
                  My account
                </Link>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-ghost"
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                  onClick={() => {
                    logout();
                    close();
                  }}
                >
                  Sign out
                </button>
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
              <a href="mailto:hutson@oilco-op.com">hutson@oilco-op.com</a>
              <a href="tel:8605616011">860-561-6011</a>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem" }}>Fax 860-561-9588</span>
              <a href="/login?next=%2Fadmin" target="_blank" rel="noopener noreferrer" onClick={close}>
                Admin
              </a>
              {!member ? (
                <>
                  <Link to="/signup" onClick={close}>
                    Join
                  </Link>
                  <Link to="/login" onClick={close}>
                    Sign in
                  </Link>
                </>
              ) : (
                <Link to="/account" onClick={close}>
                  My account
                </Link>
              )}
              <a href="https://oilco-op.com/" target="_blank" rel="noopener noreferrer">
                oilco-op.com
              </a>
            </div>
          </div>
          <div className="mkt-footer-refer">
            <h3>Refer a member</h3>
            <p>Send us a referral and we will follow up directly.</p>
            <form
              className="mkt-refer-form"
              action="mailto:hutson@oilco-op.com"
              method="post"
              encType="text/plain"
            >
              <input
                type="text"
                name="referrer_name"
                placeholder="Your name"
                value={referrerName}
                onChange={(e) => setReferrerName(e.target.value)}
                required
              />
              <input
                type="email"
                name="referrer_email"
                placeholder="Your email"
                value={referrerEmail}
                onChange={(e) => setReferrerEmail(e.target.value)}
                required
              />
              <input
                type="text"
                name="friend_name"
                placeholder="Friend's name"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                required
              />
              <input
                type="email"
                name="friend_email"
                placeholder="Friend's email"
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                required
              />
              <button type="submit" className="mkt-btn mkt-btn-primary">
                Send referral
              </button>
            </form>
          </div>
          <p className="mkt-footer-copy">
            © {new Date().getFullYear()} Citizen&apos;s Oil Co-op Inc. · West Hartford, CT · Public content reflects themes
            from{" "}
            <a href="https://oilco-op.com/" style={{ color: "rgba(255,255,255,0.65)" }}>
              oilco-op.com
            </a>
            ; confirm fees and offers with the office. Member tools sync with the internal admin system.
          </p>
        </div>
      </footer>
    </div>
  );
}
