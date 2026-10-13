import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { SocialButtons } from "../components/SocialButtons";
import { splitErrors } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/queries";
import { useNext } from "../lib/useNext";

const MIN_PASSWORD = 8;

export function Signup() {
  const { status, signup } = useAuth();
  const settings = useSettings();
  const { next, withNext } = useNext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingSecret, setTypingSecret] = useState(false);
  const [verify, setVerify] = useState(false);

  if (status === "authed") return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const problems: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD) problems.password = `Use at least ${MIN_PASSWORD} characters.`;
    else if (password !== again) problems.again = "The two passwords don't match.";
    setFields(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    try {
      if ((await signup(email.trim(), password)) === "verify") setVerify(true);
    } catch (err) {
      const { form, fields: serverFields } = splitErrors(err);
      setFields(serverFields);
      setError(form);
    } finally {
      setBusy(false);
    }
  };

  const closed = settings.data && !settings.data.enableUserRegistration;
  const apps = settings.data?.enableSocialAppsUserRegistration ? settings.data.socialApps : [];

  if (verify) {
    return (
      <AuthFrame>
        <div className="lform">
          <h1>
            Check your inbox. <em>One click to go.</em>
          </h1>
          <p className="lsub">
            We sent a confirmation link to <b>{email.trim()}</b>. Open it, then sign in.
          </p>
          <p className="lalt">
            <Link to={withNext("/login")}>Go to sign in</Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  if (closed) {
    return (
      <AuthFrame>
        <div className="lform">
          <h1>
            Invite only. <em>For now.</em>
          </h1>
          <p className="lsub">
            This server isn't accepting new sign ups. Ask an administrator to invite you, then open the link they send
            you.
          </p>
          <p className="lalt">
            <Link to={withNext("/login")}>← Back to sign in</Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      shut={typingSecret}
      wince={!!error || Object.keys(fields).length > 0}
      footer={[`creating an account on ${window.location.host}`, "eyes shut while you type a password"]}
    >
      <form onSubmit={submit} noValidate>
        <h1>
          Take a seat. <em>We'll keep watch.</em>
        </h1>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-invalid={!!fields.email}
        />
        {fields.email && <p className="ferr">{fields.email}</p>}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setTypingSecret(true)}
          onBlur={() => setTypingSecret(false)}
          aria-invalid={!!fields.password}
        />
        {fields.password ? <p className="ferr">{fields.password}</p> : <p className="fhint">At least {MIN_PASSWORD} characters.</p>}

        <label htmlFor="again">Confirm password</label>
        <input
          id="again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          onFocus={() => setTypingSecret(true)}
          onBlur={() => setTypingSecret(false)}
          aria-invalid={!!fields.again}
        />
        {fields.again && <p className="ferr">{fields.again}</p>}

        {error && (
          <p className="form-err" role="alert">
            {error}
          </p>
        )}
        <button className="go" disabled={busy}>
          {busy ? "Creating account…" : "Create account"} <span aria-hidden="true">→</span>
        </button>

        <p className="lalt">
          Already have an account? <Link to={withNext("/login")}>Sign in</Link>
        </p>

        <SocialButtons apps={apps} next={next} />
      </form>
    </AuthFrame>
  );
}
