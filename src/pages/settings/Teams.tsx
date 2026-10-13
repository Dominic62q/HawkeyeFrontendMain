import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { errorMessage } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { useCreateTeam, useDeleteTeam, useOrgDetail, useTeams } from "../../lib/queries";
import { can, slugify } from "../../lib/settings";
import type { Team } from "../../lib/types";

function NewTeam({ org, onClose }: { org: string; onClose: () => void }) {
  const create = useCreateTeam(org);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const slug = slugify(name);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    if (!slug) return setProblem("Give the team a name.");
    create.mutate(slug, { onSuccess: onClose, onError: (err) => setProblem(errorMessage(err)) });
  };

  return (
    <Dialog title="New team" narrow onClose={onClose}>
      <form className="mform" onSubmit={submit} noValidate>
        <label className="fld">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Backend" autoFocus />
          {slug && <small>Will be called “{slug}”.</small>}
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
          <button className="btn pri" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create team"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function TeamRow({ t, org, canDelete }: { t: Team; org: string; canDelete: boolean }) {
  const remove = useDeleteTeam(org);
  const [confirming, setConfirming] = useState(false);
  const projects = t.projects ?? [];
  return (
    <div className="row srow">
      <div style={{ minWidth: 0 }}>
        <div className="ititle">
          <strong>{t.slug}</strong>
        </div>
        <div className="imeta">
          <span>
            {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
          </span>
          <span>·</span>
          <span>{projects.length ? projects.map((p) => p.name).join(", ") : "no projects"}</span>
        </div>
      </div>
      <div className="memacts">
        <span className="age">created {timeAgo(t.dateCreated)}</span>
        {canDelete && (
          <button className="link-btn tight danger" onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
      </div>
      {confirming && (
        <Dialog title="Delete this team?" narrow onClose={() => setConfirming(false)}>
          <p className="dlg-text">
            Members stay in the organization, but they lose access to anything only this team could see.
            {projects.length > 0 && " Its projects are not deleted."}
          </p>
          {remove.isError && (
            <p className="form-problem" role="alert">
              {errorMessage(remove.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              className="btn danger solid"
              disabled={remove.isPending}
              onClick={() => remove.mutate(t.slug, { onSuccess: () => setConfirming(false) })}
            >
              {remove.isPending ? "Deleting…" : "Delete team"}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}

export function Teams() {
  const { org = "" } = useParams();
  const detail = useOrgDetail(org);
  const teams = useTeams(org);
  const [creating, setCreating] = useState(false);

  if (teams.isLoading || detail.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!teams.data) return <div className="err-box">Couldn't load teams.</div>;

  const access = detail.data?.access;
  return (
    <>
      <div className="shead-row">
        <h2 className="shead">Teams</h2>
        {can(access, "team:write") && (
          <button className="btn pri" onClick={() => setCreating(true)}>
            New team
          </button>
        )}
      </div>
      <p className="hint">Teams decide who can see which projects.</p>
      {teams.data.length === 0 ? (
        <div className="card">
          <div className="empty">
            <h2>No teams yet</h2>
            <p>Create a team before adding projects. Every project belongs to at least one.</p>
          </div>
        </div>
      ) : (
        <div className="card table">
          {teams.data.map((t) => (
            <TeamRow key={t.id} t={t} org={org} canDelete={can(access, "team:admin")} />
          ))}
        </div>
      )}
      {creating && <NewTeam org={org} onClose={() => setCreating(false)} />}
    </>
  );
}
