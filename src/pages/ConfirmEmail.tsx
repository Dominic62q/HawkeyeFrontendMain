import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Outcome = "working" | "done" | "expired";

/** Where the confirmation link in the "verify your address" email lands. */
export function ConfirmEmail() {
  const { key = "" } = useParams();
  const { status } = useAuth();
  const [outcome, setOutcome] = useState<Outcome>("working");
  // A key only works once, and StrictMode runs effects twice in development.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // The config call sets the CSRF cookie a signed-out visitor doesn't have yet.
    api("/_allauth/browser/v1/config")
      .then(() => api("/_allauth/browser/v1/auth/email/verify", { method: "POST", body: { key } }))
      .then(() => setOutcome("done"))
      .catch((err) => {
        // allauth answers 401 when the address is confirmed but the user still has to sign in.
        setOutcome(err instanceof ApiError && err.status === 401 ? "done" : "expired");
      });
  }, [key]);

  const next = status === "authed" ? { to: "/", label: "Continue" } : { to: "/login", label: "Sign in" };

  return (
    <AuthFrame>
      <div className="lform">
        {outcome === "working" && <p className="lsub">Confirming your email…</p>}
        {outcome === "done" && (
          <>
            <h1>
              Email confirmed. <em>Thanks.</em>
            </h1>
            <p className="lalt">
              <Link to={next.to}>{next.label}</Link>
            </p>
          </>
        )}
        {outcome === "expired" && (
          <>
            <h1>
              That link has run out. <em>They do that.</em>
            </h1>
            <p className="lsub">
              The confirmation link is invalid or already used. Open Account → Emails to request a new one.
            </p>
            <p className="lalt">
              <Link to={next.to}>{next.label}</Link>
            </p>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
