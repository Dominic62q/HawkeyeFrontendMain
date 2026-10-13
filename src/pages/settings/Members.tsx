import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { CopyButton } from "../../components/Copy";
import { Dialog } from "../../components/Dialog";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { initials, timeAgo } from "../../lib/format";
import {
  useInviteMember,
  useMembers,
  useOrgDetail,
  useRemoveMember,
  useUpdateMember,
} from "../../lib/queries";
import { ROLES, can } from "../../lib/settings";
import type { Member, MemberInvite, OrgRole } from "../../lib/types";

function InviteDialog({ org, onClose }: { org: string; onClose: () => void }) {
  const invite = useInviteMember(org);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState<MemberInvite | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setProblem("Enter a valid email address.");
    invite.mutate(
      { email: email.trim(), orgRole: role },
      { onSuccess: setSent, onError: (err) => setProblem(errorMessage(err)) },
    );
  };

  if (sent) {
    return (
      <Dialog title="Invitation created" narrow onClose={onClose}>
        <p className="dlg-text">
          {sent.email} has been invited as {sent.roleName.toLowerCase()}.
          {sent.inviteLink
            ? " Email may not be set up on this server, so share this link with them directly:"
            : " They'll get an email with a link to join."}
        </p>
        {sent.inviteLink && (
          <div className="dsn" style={{ marginTop: 12 }}>
            <code>{sent.inviteLink}</code>
            <CopyButton text={sent.inviteLink} label="Copy link" />
          </div>
        )}
        <footer className="dlg-foot">
          <button className="btn pri" onClick={onClose}>
            Done
          </button>
        </footer>
      </Dialog>
    );
  }

  return (
    <Dialog title="Invite a member" onClose={onClose}>
      <form className="mform" onSubmit={submit} noValidate>
        <label className="fld">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            autoFocus
          />
        </label>
        <label className="fld">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
            {ROLES.filter((r) => r.id !== "owner").map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <small>{ROLES.find((r) => r.id === role)?.hint}</small>
        </label>
        {problem && (
          <p className="form-problem" role="alert">
            {problem}
          </p>
        )}
        <footer className="dlg-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={invite.isPending}>
            {invite.isPending ? "Inviting…" : "Send invite"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function MemberRow({
  m,
  org,
  me,
  editable,
}: {
  m: Member;
  org: string;
  me: boolean;
  editable: boolean;
}) {
  const update = useUpdateMember(org);
  const remove = useRemoveMember(org);
  const invite = useInviteMember(org);
  const [confirming, setConfirming] = useState(false);
  const [resent, setResent] = useState(false);
  const locked = m.isOwner || me;

  return (
    <div className="row mem">
      <div className="avatar" aria-hidden>
        {initials(m.email)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="ititle">
          <strong>{m.user?.name || m.email}</strong>
          {me && <span className="tag">You</span>}
          {m.pending && <span className="tag new">Invited</span>}
        </div>
        <div className="imeta">
          {m.user?.name && <span>{m.email}</span>}
          <span>
            {m.pending
              ? `invited ${timeAgo(m.dateCreated)}`
              : m.user?.lastLogin
                ? `last seen ${timeAgo(m.user.lastLogin)}`
                : `joined ${timeAgo(m.dateCreated)}`}
          </span>
        </div>
      </div>
      <div className="memrole">
        {editable && !locked ? (
          <select
            className="ctl"
            aria-label={`Role for ${m.email}`}
            value={m.role}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: m.id, orgRole: e.target.value as OrgRole })}
          >
            {ROLES.filter((r) => r.id !== "owner").map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="soft">{m.roleName}</span>
        )}
      </div>
      <div className="memacts">
        {editable && m.pending && (
          <button
            className="link-btn tight"
            disabled={invite.isPending}
            onClick={() =>
              invite.mutate({ email: m.email, orgRole: m.role }, { onSuccess: () => setResent(true) })
            }
          >
            {resent ? "Sent" : "Resend"}
          </button>
        )}
        {editable && !locked && (
          <button className="link-btn tight danger" onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}
      </div>
      {update.isError && (
        <p className="form-problem memerr" role="alert">
          {errorMessage(update.error)}
        </p>
      )}
      {confirming && (
        <Dialog title={m.pending ? "Cancel this invite?" : "Remove this member?"} narrow onClose={() => setConfirming(false)}>
          <p className="dlg-text">
            {m.pending
              ? `${m.email} won't be able to join with the invite they were sent.`
              : `${m.user?.name || m.email} will lose access to ${org} straight away.`}
          </p>
          {remove.isError && (
            <p className="form-problem" role="alert">
              {errorMessage(remove.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={() => setConfirming(false)}>
              Keep
            </button>
            <button
              className="btn danger solid"
              disabled={remove.isPending}
              onClick={() => remove.mutate(m.id, { onSuccess: () => setConfirming(false) })}
            >
              {remove.isPending ? "Removing…" : m.pending ? "Cancel invite" : "Remove"}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}

export function Members() {
  const { org = "" } = useParams();
  const { user } = useAuth();
  const detail = useOrgDetail(org);
  const members = useMembers(org);
  const [inviting, setInviting] = useState(false);

  if (members.isLoading || detail.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!members.data) return <div className="err-box">Couldn't load members.</div>;

  const editable = can(detail.data?.access, "member:write");
  const active = members.data.filter((m) => !m.pending);
  const pending = members.data.filter((m) => m.pending);
  const row = (m: Member) => (
    <MemberRow key={m.id} m={m} org={org} me={!!user && m.email.toLowerCase() === user.email.toLowerCase()} editable={editable} />
  );

  return (
    <>
      <div className="shead-row">
        <h2 className="shead">Members</h2>
        {editable && (
          <button className="btn pri" onClick={() => setInviting(true)}>
            Invite member
          </button>
        )}
      </div>
      <div className="card table">{active.map(row)}</div>
      {pending.length > 0 && (
        <>
          <h3 className="sec" style={{ margin: "28px 0 12px" }}>
            Pending invites
          </h3>
          <div className="card table">{pending.map(row)}</div>
        </>
      )}
      {inviting && <InviteDialog org={org} onClose={() => setInviting(false)} />}
    </>
  );
}
