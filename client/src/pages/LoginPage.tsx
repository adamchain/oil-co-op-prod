import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

export default function LoginPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin(creds: { email: string; password: string }) {
    setErr("");
    setLoading(true);
    try {
      const res = await api<{
        token: string;
        member: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          memberNumber?: string;
          role?: string;
        };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      });
      setSession(res.token, res.member);
      const next = searchParams.get("next");
      if (next && res.member.role === "admin" && next.startsWith("/admin")) {
        nav(next);
      } else {
        nav(res.member.role === "admin" ? "/admin/workbench" : "/account");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin({ email, password });
  }

  return (
    <div className="mkt-panel">
      <h1 className="mkt-page-title">Member sign in</h1>
      <p className="mkt-lead">Access your account, notification preferences, and renewal details.</p>
      <div className="mkt-card-form" style={{ maxWidth: "400px" }}>
        <form onSubmit={onSubmit}>
          <div className="mkt-field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="mkt-field">
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="mkt-error">{err}</p>}
          <button type="submit" className="mkt-btn mkt-btn-primary" disabled={loading}>
            {loading ? "…" : "Sign in"}
          </button>
        </form>
      </div>
      <p className="mkt-lead" style={{ marginTop: "1.25rem" }}>
        <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
