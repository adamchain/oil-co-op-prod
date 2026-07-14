import { Link } from "react-router-dom";

/** Secondary marketing page — "Testimonials". Member quotes + video live here. */
export default function TestimonialsPage() {
  return (
    <div className="mkt-panel" style={{ maxWidth: "760px" }}>
      <h1 className="mkt-page-title">Member testimonials</h1>
      <p className="mkt-lead">What members say about saving with the Co-op.</p>

      <div className="mkt-testimonials" style={{ marginBottom: "2rem" }}>
        <figure className="mkt-quote-card">
          <blockquote>
            &ldquo;The reduced per-gallon cost helps our household budget — we keep telling friends about the
            program.&rdquo;
          </blockquote>
          <cite>Mark &amp; Alison Laucella, Middletown · members since 2007</cite>
        </figure>
        <figure className="mkt-quote-card">
          <blockquote>
            &ldquo;Switching home and auto insurance through the Co-op&apos;s Bearingstar program saved hundreds compared
            to our old carrier.&rdquo;
          </blockquote>
          <cite>Member testimonial (insurance)</cite>
        </figure>
      </div>

      <div className="mkt-card-form">
        <p className="mkt-prose" style={{ margin: 0 }}>
          The member video and additional testimonials will live here. Send any quotes or the video link you&apos;d like
          featured.
        </p>
      </div>

      <p className="mkt-lead">
        <Link to="/signup">Join the Co-op →</Link>
      </p>
    </div>
  );
}
