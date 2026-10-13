import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Eye } from "../components/Logo";
import { MfaRequiredError, useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";

export function Login() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") {
    const next = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={next} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof MfaRequiredError
          ? "This account uses two-factor authentication, which the new app doesn't support yet. Sign in with the classic app."
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="lhero">
        <span className="logo eye-wrap">
          <Eye />
          Hawkeye
        </span>
        <div>
          <h2>
            See what your code is <em>hiding.</em>
          </h2>
          <p>
            Every exception, every slow request, every site that goes dark, gathered in one calm
            place and ranked by what actually needs you.
          </p>
        </div>
        <div className="foot">self-hosted · your data stays yours</div>
        <svg className="rings" viewBox="0 0 640 640" fill="none" stroke="#f3efe6" strokeOpacity=".16" aria-hidden="true">
          <circle cx="320" cy="320" r="100" />
          <circle cx="320" cy="320" r="170" />
          <circle cx="320" cy="320" r="240" />
          <circle cx="320" cy="320" r="310" />
          <circle cx="320" cy="320" r="26" fill="#e8431a" stroke="none" />
        </svg>
      </div>
      <div className="lform">
        <form onSubmit={submit} noValidate>
          <h1>Welcome back</h1>
          <p className="sub">Sign in to your workspace.</p>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="form-err" role="alert">
              {error}
            </p>
          )}
          <button className="btn pri" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
