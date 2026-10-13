import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Logo } from "../components/Logo";
import { MfaRequiredError, useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function greeting(hour: number): [string, string] {
  if (hour < 5) return ["Still up?", "Let's see what broke."];
  if (hour < 12) return ["Morning.", "Let's see what broke overnight."];
  if (hour < 18) return ["Afternoon.", "Let's see what's broken."];
  return ["Evening.", "Let's see what broke today."];
}

/**
 * A wall-sized eye. The pupil follows the pointer, it blinks now and then,
 * and it shuts while a password is being typed.
 */
function WatchingEye({ shut, wince }: { shut: boolean; wince: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const pupil = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    const look = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || !pupil.current) return;
      const dx = (e.clientX - (box.left + box.width / 2)) / box.width;
      const dy = (e.clientY - (box.top + box.height / 2)) / box.height;
      const x = Math.max(-1, Math.min(1, dx * 3)) * 30;
      const y = Math.max(-1, Math.min(1, dy * 3)) * 12;
      pupil.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener("pointermove", look);
    return () => window.removeEventListener("pointermove", look);
  }, []);

  return (
    <svg
      ref={ref}
      className={`watcher ${shut ? "shut" : ""} ${wince ? "wince" : ""}`}
      viewBox="0 0 200 100"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="lids">
          <path d="M4 50C44 6 76 4 100 4C124 4 156 6 196 50C156 94 124 96 100 96C76 96 44 94 4 50Z" />
        </clipPath>
      </defs>
      <g className="lidwrap">
        <path
          className="lid-line"
          d="M4 50C44 6 76 4 100 4C124 4 156 6 196 50C156 94 124 96 100 96C76 96 44 94 4 50Z"
        />
        <g clipPath="url(#lids)">
          <g className="gaze" ref={pupil}>
            <circle className="iris" cx="100" cy="50" r="34" />
            <circle className="ticks" cx="100" cy="50" r="28" />
            <circle className="ring" cx="100" cy="50" r="20" />
            <circle className="pupil" cx="100" cy="50" r="13" />
            <circle className="glint" cx="106" cy="44" r="3.4" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function Login() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingSecret, setTypingSecret] = useState(false);
  const [lead, rest] = greeting(new Date().getHours());

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
      <WatchingEye shut={typingSecret} wince={!!error} />

      <header className="lhead">
        <Logo />
      </header>

      <main className="lmain">
        <form onSubmit={submit} noValidate>
          <h1>
            {lead} <em>{rest}</em>
          </h1>

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
        </form>
      </main>

      <footer className="lfoot">
        <span>signing in to {window.location.host}</span>
        <span>eyes shut while you type a password</span>
      </footer>
    </div>
  );
}
