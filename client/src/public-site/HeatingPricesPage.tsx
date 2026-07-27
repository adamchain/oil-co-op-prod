import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type OilPrice = {
  _id: string;
  weekOf: string;
  coopPrice: number;
  statePrice: number | null;
  priceDifference: number | null;
};

function formatDisplayDate(weekOf: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekOf);
  if (!m) return weekOf;
  return `${m[2]}/${m[3]}/${m[1].slice(2)}`;
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toFixed(3);
}

const PAGE_SIZE = 20;

/** Public heating-oil price history (mirrors oilco-op.com/services/heating-prices/). */
export default function HeatingPricesPage() {
  const [rows, setRows] = useState<OilPrice[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api<{ oilPrices: OilPrice[]; total: number; totalPages: number; page: number }>(
      `/api/oil-prices?limit=${PAGE_SIZE}&page=${page}`
    )
      .then((res) => {
        if (cancelled) return;
        setRows(res.oilPrices || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load prices");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const pageNumbers = Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1);

  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">Heating prices</h1>
      <div className="mkt-prose" style={{ marginBottom: "1.5rem" }}>
        <p>
          Our contracted &ldquo;Co-op Price&rdquo; is based on daily wholesale pricing. We have secured long-term contracts
          that guarantee our members will pay lower prices for many years to come!
        </p>
        <p>
          Oil Co-op members pay 40 to 50 cents or more below the State average for full-service heating oil.
        </p>
        <p>
          Historically, the greatest savings for Co-op members occurs in the dead of winter — between January and March —
          when demand and prices are highest.
        </p>
      </div>

      <p style={{ marginBottom: "1.5rem" }}>
        <Link to="/signup" className="mkt-btn mkt-btn-primary">
          Join Citizen&apos;s Oil Co-op
        </Link>
      </p>

      <h2 className="mkt-faq-category-title">Join today and begin saving!</h2>

      {error && <p className="mkt-error">{error}</p>}
      {loading && <p className="mkt-lead">Loading prices…</p>}

      {!loading && !error && (
        <>
          {totalPages > 1 && (
            <nav className="mkt-price-pager" aria-label="Price history pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page">
                |&lt;&lt;
              </button>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                &lt;
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === page ? "is-active" : undefined}
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                &gt;
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                aria-label="Last page"
              >
                &gt;&gt;|
              </button>
            </nav>
          )}

          <div className="mkt-price-table-wrap">
            <table className="mkt-price-table">
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col">Week</th>
                  <th scope="col">Avg. Co-op Price*</th>
                  <th scope="col">Avg. State Price**</th>
                  <th scope="col">Price Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row._id}>
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>{formatDisplayDate(row.weekOf)}</td>
                    <td>{formatMoney(row.coopPrice)}</td>
                    <td>{formatMoney(row.statePrice)}</td>
                    <td>{formatMoney(row.priceDifference)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5}>No prices published yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mkt-lead" style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
        </>
      )}

      <div className="mkt-prose" style={{ marginTop: "2rem" }}>
        <p>
          <em>
            *Avg. Co-op Price reflects Greater Hartford and Central Connecticut. Please call for current Co-op price in
            your area.
          </em>
        </p>
        <p>
          <em>
            **Avg. State Price is supplied from October to March by US Energy Information Administration weekly survey.
          </em>
        </p>
      </div>
    </div>
  );
}
