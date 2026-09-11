import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type SessionMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  memberNumber?: string;
  role?: string;
};

export default function LoginPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useAuth();
  const adminNext = searchParams.get("next")?.startsWith("/admin") ?? false;
  const [staffMode, setStaffMode] = useState(adminNext);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  function go(member: SessionMember, token: string) {
    setSession(token, member);
    const next = searchParams.get("next");
    if (next && member.role === "admin" && next.startsWith("/admin")) {
      nav(next);
    } else {
      nav(member.role === "admin" ? "/admin/workbench" : "/account");
    }
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      await api<{ ok: boolean }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCodeSent(true);
      setInfo("If we have an account for that email, we sent a 6-digit code. It expires in 10 minutes.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await api<{ token: string; member: SessionMember }>("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      go(res.member, res.token);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function staffLogin(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await api<{ token: string; member: SessionMember }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      go(res.member, res.token);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mkt-panel">
      <h1 className="mkt-page-title">{staffMode ? "Staff sign in" : "Member sign in"}</h1>
      <p className="mkt-lead">
        {staffMode
          ? "Office staff use email and password."
          : "We'll email you a one-time code. No password needed."}
      </p>
      <div className="mkt-card-form" style={{ maxWidth: "400px" }}>
        {staffMode ? (
          <form onSubmit={(e) => void staffLogin(e)}>
            <div className="mkt-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mkt-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {err && <p className="mkt-error">{err}</p>}
            <button type="submit" className="mkt-btn mkt-btn-primary" disabled={loading}>
              {loading ? "…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void (codeSent ? verifyCode(e) : sendCode(e))}>
            <div className="mkt-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCodeSent(false);
                  setCode("");
                  setInfo("");
                }}
              />
            </div>
            {codeSent && (
              <div className="mkt-field">
                <label htmlFor="login-code">Sign-in code</label>
                <input
                  id="login-code"
                  className="mkt-code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
            )}
            {info && <p className="mkt-lead" style={{ marginTop: 0 }}>{info}</p>}
            {err && <p className="mkt-error">{err}</p>}
            <button type="submit" className="mkt-btn mkt-btn-primary" disabled={loading}>
              {loading ? "…" : codeSent ? "Sign in" : "Email me a code"}
            </button>
            {codeSent && (
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={loading}
                onClick={() => void sendCode()}
              >
                Resend code
              </button>
            )}
          </form>
        )}
      </div>
      <p className="mkt-lead" style={{ marginTop: "1.25rem" }}>
        {staffMode ? (
          <button
            type="button"
            className="mkt-text-btn"
            onClick={() => {
              setStaffMode(false);
              setErr("");
              setPassword("");
            }}
          >
            Member sign in with email code
          </button>
        ) : (
          <>
            <Link to="/signup">Create an account</Link>
            {" · "}
            <button
              type="button"
              className="mkt-text-btn"
              onClick={() => {
                setStaffMode(true);
                setErr("");
                setInfo("");
                setCodeSent(false);
              }}
            >
              Staff sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
