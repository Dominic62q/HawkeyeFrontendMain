import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCreateOrganization } from "../lib/queries";

/** Shown to a signed-in user who doesn't belong to any organization yet. */
export function Onboarding() {
  const { user, logout } = useAuth();
  const create = useCreateOrganization();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Give your organization a name.");
    create.mutate(name.trim(), {
      onSuccess: (org) => navigate(`/${org.slug}/issues`, { replace: true }),
      onError: (err) => {
        if (err instanceof ApiError && err.status === 403) setClosed(true);
        else setError(errorMessage(err));
      },
    });
  };

  return (
    <AuthFrame wince={!!error} footer={[`signed in as ${user?.email ?? ""}`, "an organization holds your projects and people"]}>
      {closed ? (
        <div className="lform">
          <h1>
            Almost in. <em>You need an invite.</em>
          </h1>
          <p className="lsub">
            This server doesn't let people create their own organizations. Ask an administrator to invite you, then open
            the link they send.
          </p>
          <p className="lalt">
            <button className="llink" onClick={() => void logout()}>
              Sign out
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1>
            You're in. <em>Name your organization.</em>
          </h1>
          <p className="lsub">It's where your projects and teammates live. You can change the name later.</p>

          <label htmlFor="org">Organization name</label>
          <input
            id="org"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
            maxLength={200}
          />

          {error && (
            <p className="form-err" role="alert">
              {error}
            </p>
          )}
          <button className="go" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create organization"} <span aria-hidden="true">→</span>
          </button>
          <p className="lalt">
            Waiting for an invite instead?{" "}
            <button type="button" className="llink" onClick={() => void logout()}>
              Sign out
            </button>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
