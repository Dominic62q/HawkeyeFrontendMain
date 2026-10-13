import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/queries";

export function ForgotPassword() {
  const { requestReset } = useAuth();
  const settings = useSettings();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const emailWorks = settings.data?.enabledFeatures.includes("email");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await requestReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (settings.data && !emailWorks) {
    return (
      <AuthFrame>
        <div className="lform">
          <h1>
            No email here. <em>So no reset link.</em>
          </h1>
          <p className="lsub">
            This server can't send email, so it can't send you a reset link. Ask an administrator to set a new password
            for you.
          </p>
          <p className="lalt">
            <Link to="/login">← Back to sign in</Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  if (sent) {
    return (
      <AuthFrame>
        <div className="lform">
          <h1>
            Sent. <em>Check your inbox.</em>
          </h1>
          <p className="lsub">
            If <b>{email.trim()}</b> has an account, a link to choose a new password is on its way. It can take a minute
            to arrive.
          </p>
          <p className="lalt">
            <Link to="/login">← Back to sign in</Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame wince={!!error} footer={[`resetting a password on ${window.location.host}`, "it happens to everyone"]}>
      <form onSubmit={submit} noValidate>
        <h1>
          Locked out? <em>Let's fix that.</em>
        </h1>
        <p className="lsub">Enter your email and we'll send a link to choose a new password.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        {error && (
          <p className="form-err" role="alert">
            {error}
          </p>
        )}
        <button className="go" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"} <span aria-hidden="true">→</span>
        </button>

        <p className="lalt">
          <Link to="/login">← Back to sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
