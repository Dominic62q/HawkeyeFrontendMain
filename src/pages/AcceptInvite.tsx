import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthFrame } from "../components/AuthFrame";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAcceptInvite, useInvite, useOrganizations } from "../lib/queries";

function Signed({ id, token, orgName, orgSlug }: { id: string; token: string; orgName: string; orgSlug: string }) {
  const { user, logout } = useAuth();
  const orgs = useOrganizations();
  const accept = useAcceptInvite(id, token);
  const navigate = useNavigate();
  const already = orgs.data?.some((o) => o.slug === orgSlug);

  if (already) {
    return (
      <>
        <p className="lsub">
          {user?.email} is already part of {orgName}. If this invite was meant for someone else, sign out and open it
          again with their account.
        </p>
        <p className="lalt">
          <Link to={`/${orgSlug}/issues`}>Go to {orgName}</Link>
          <span aria-hidden="true">·</span>
          <button className="llink" onClick={() => void logout()}>
            Sign out
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="lsub">
        You'll join as <b>{user?.email}</b>.
      </p>
      {accept.isError && (
        <p className="form-err" role="alert">
          {errorMessage(accept.error)}
        </p>
      )}
      <button
        className="go"
        disabled={accept.isPending || orgs.isLoading}
        onClick={() => accept.mutate(undefined, { onSuccess: () => navigate(`/${orgSlug}/issues`, { replace: true }) })}
      >
        {accept.isPending ? "Joining…" : "Accept invitation"} <span aria-hidden="true">→</span>
      </button>
      <p className="lalt">
        Not you?{" "}
        <button className="llink" onClick={() => void logout()}>
          Sign out
        </button>
      </p>
    </>
  );
}

export function AcceptInvite() {
  const { id = "", token = "" } = useParams();
  const { status } = useAuth();
  const invite = useInvite(id, token);
  const here = `/accept/${id}/${token}`;
  const q = `?next=${encodeURIComponent(here)}`;

  if (invite.isLoading || status === "loading") {
    return (
      <AuthFrame>
        <div className="lform">
          <div className="skel" style={{ height: 60, width: "80%" }} />
        </div>
      </AuthFrame>
    );
  }

  if (!invite.data) {
    return (
      <AuthFrame>
        <div className="lform">
          <h1>
            This invite is no good. <em>Maybe it expired.</em>
          </h1>
          <p className="lsub">The link may be old, or it was cancelled. Ask the person who invited you to send a new one.</p>
          <p className="lalt">
            <Link to="/">Go to Hawkeye</Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  const org = invite.data.orgUser.organization;
  return (
    <AuthFrame footer={[`invitation for ${org.name}`, "valid until the invite is used or cancelled"]}>
      <div className="lform">
        <h1>
          You're invited. <em>Join {org.name}.</em>
        </h1>
        {status === "authed" ? (
          <Signed id={id} token={token} orgName={org.name} orgSlug={org.slug} />
        ) : (
          <>
            <p className="lsub">Create an account, or sign in if you already have one. Then you're in.</p>
            <Link className="go" to={`/signup${q}`}>
              Create an account <span aria-hidden="true">→</span>
            </Link>
            <p className="lalt">
              Already have one? <Link to={`/login${q}`}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
