import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { splitErrors } from "../lib/api";
import { useAuth } from "../lib/auth";

const MIN_PASSWORD = 8;

export function ResetPassword() {
  const { key = "" } = useParams();
  const { checkResetKey, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    checkResetKey(key).then((ok) => live && setValid(ok));
    return () => {
      live = false;
    };
    // checkResetKey is recreated every render; the key is what matters.
  }, [key]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    if (password.length < MIN_PASSWORD) return setProblem(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== again) return setProblem("The two passwords don't match.");
    setBusy(true);
    try {
      await resetPassword(key, password);
      navigate("/login", { replace: true, state: { notice: "Password updated. Sign in with the new one." } });
    } catch (err) {
      const { form, fields } = splitErrors(err);
      setProblem(fields.password ?? form ?? "");
      setBusy(false);
    }
  };

  if (valid === false) {
    return (
      <AuthFrame>
        <div className="lform">
          <h1>
            That link has run out. <em>They do that.</em>
          </h1>
          <p className="lsub">Reset links work once and expire after a while. Ask for a fresh one.</p>
          <p className="lalt">
            <Link to="/forgot-password">Send me a new link</Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame shut wince={!!problem} footer={[`resetting a password on ${window.location.host}`, "eyes shut while you type a password"]}>
      <form onSubmit={submit} noValidate>
        <h1>
          New password. <em>Make it a good one.</em>
        </h1>

        <label htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="fhint">At least {MIN_PASSWORD} characters.</p>

        <label htmlFor="again">Confirm password</label>
        <input
          id="again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />

        {problem && (
          <p className="form-err" role="alert">
            {problem}
          </p>
        )}
        <button className="go" disabled={busy || valid === null}>
          {busy ? "Saving…" : "Set password"} <span aria-hidden="true">→</span>
        </button>
      </form>
    </AuthFrame>
  );
}
