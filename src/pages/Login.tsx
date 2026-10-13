import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { SocialButtons } from "../components/SocialButtons";
import { MfaRequiredError, useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { useSettings } from "../lib/queries";
import { useNext } from "../lib/useNext";

function greeting(hour: number): [string, string] {
  if (hour < 5) return ["Still up?", "Let's see what broke."];
  if (hour < 12) return ["Morning.", "Let's see what broke overnight."];
  if (hour < 18) return ["Afternoon.", "Let's see what's broken."];
  return ["Evening.", "Let's see what broke today."];
}

/** Lengths allauth accepts: 6 digit TOTP code, 8 character or 16 character recovery code. */
const CODE_LENGTHS = [6, 8, 16];

function SecondFactor({ types, onBack }: { types: string[]; onBack: () => void }) {
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const usable = types.length === 0 || types.some((t) => t === "totp" || t === "recovery_codes");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = code.replace(/\s+/g, "");
    if (!CODE_LENGTHS.includes(clean.length)) {
      setError("Enter the 6 digit code from your authenticator app, or a recovery code.");
      return;
    }
    setBusy(true);
    try {
      await verifyMfa(clean);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame wince={!!error} footer={[`on ${window.location.host}`, "one more check before you're in"]}>
      <form onSubmit={submit} noValidate>
        <h1>
          One more thing. <em>Prove it's you.</em>
        </h1>
        {usable ? (
          <>
            <p className="lsub">
              Open your authenticator app and enter the 6 digit code. Lost your phone? A recovery code works too.
            </p>
            <label htmlFor="code">Code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              spellCheck={false}
              className="lcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000 000"
            />
            {error && (
              <p className="form-err" role="alert">
                {error}
              </p>
            )}
            <button className="go" disabled={busy}>
              {busy ? "Checking…" : "Verify"} <span aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <p className="form-err">
            This account only has a security key set up, which the new app doesn't support yet. Sign in with the
            classic app instead.
          </p>
        )}
        <p className="lalt">
          <button type="button" className="llink" onClick={onBack}>
            ← Use a different account
          </button>
        </p>
      </form>
    </AuthFrame>
  );
}

export function Login() {
  const { status, login } = useAuth();
  const settings = useSettings();
  const location = useLocation();
  const { next, withNext } = useNext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingSecret, setTypingSecret] = useState(false);
  const [mfa, setMfa] = useState<string[] | null>(null);
  const [lead, rest] = greeting(new Date().getHours());

  const notice = (location.state as { notice?: string } | null)?.notice;

  if (status === "authed") return <Navigate to={next} replace />;

  if (mfa) return <SecondFactor types={mfa} onBack={() => setMfa(null)} />;

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
      if (err instanceof MfaRequiredError) setMfa(err.types);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const open = settings.data?.enableUserRegistration;
  const apps = settings.data?.socialApps ?? [];

  return (
    <AuthFrame
      shut={typingSecret}
      wince={!!error}
      footer={[`signing in to ${window.location.host}`, "eyes shut while you type a password"]}
    >
      <form onSubmit={submit} noValidate>
        <h1>
          {lead} <em>{rest}</em>
        </h1>

        {notice && (
          <p className="form-ok" role="status">
            {notice}
          </p>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setTypingSecret(true)}
          onBlur={() => setTypingSecret(false)}
        />

        {error && (
          <p className="form-err" role="alert">
            {error}
          </p>
        )}
        <button className="go" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"} <span aria-hidden="true">→</span>
        </button>

        <p className="lalt">
          <Link to="/forgot-password">Forgot your password?</Link>
          {open && (
            <>
              <span aria-hidden="true">·</span>
              <Link to={withNext("/signup")}>Create an account</Link>
            </>
          )}
        </p>

        <SocialButtons apps={apps} next={next} />
      </form>
    </AuthFrame>
  );
}
