import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { errorMessage } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { useCreateProject, useOrgDetail, useOrgProjects } from "../../lib/queries";
import { PLATFORMS, can, platformLabel } from "../../lib/settings";

function NewProject({ org, onClose }: { org: string; onClose: () => void }) {
  const detail = useOrgDetail(org);
  const create = useCreateProject(org);
  const navigate = useNavigate();
  const teams = detail.data?.teams ?? [];
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [team, setTeam] = useState("");
  const [problem, setProblem] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    const chosen = team || teams[0]?.slug;
    if (!name.trim()) return setProblem("Give the project a name.");
    if (!chosen) return setProblem("Create a team first. Every project belongs to one.");
    create.mutate(
      { name: name.trim(), platform: platform || null, team: chosen },
      {
        onSuccess: (p) => {
          onClose();
          navigate(`/${org}/settings/projects/${p.slug}`);
        },
        onError: (err) => setProblem(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog title="New project" onClose={onClose}>
      <form className="mform" onSubmit={submit} noValidate>
        <label className="fld">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Storefront API" autoFocus />
        </label>
        <label className="fld">
          Platform <span className="opt">optional</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Choose later</option>
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          Team
          <select value={team || teams[0]?.slug || ""} onChange={(e) => setTeam(e.target.value)}>
            {teams.length === 0 && <option value="">No teams yet</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.slug}
              </option>
            ))}
          </select>
          <small>The team whose members can see this project.</small>
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
            {create.isPending ? "Creating…" : "Create project"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export function Projects() {
  const { org = "" } = useParams();
  const detail = useOrgDetail(org);
  const list = useOrgProjects(org);
  const [creating, setCreating] = useState(false);

  if (detail.isLoading || list.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!detail.data || !list.data) return <div className="err-box">Couldn't load projects.</div>;

  const projects = list.data;
  const canCreate = can(detail.data.access, "project:write");

  return (
    <>
      <div className="shead-row">
        <h2 className="shead">Projects</h2>
        {canCreate && (
          <button className="btn pri" onClick={() => setCreating(true)}>
            New project
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <div className="empty">
            <h2>No projects yet</h2>
            <p>A project is one app or service. Create one to get a DSN and start receiving errors.</p>
          </div>
        </div>
      ) : (
        <div className="card table">
          {projects.map((p) => (
            <div key={p.id} className="row srow">
              <div style={{ minWidth: 0 }}>
                <Link className="rowlink" to={`/${org}/settings/projects/${p.slug}`}>
                  <div className="ititle">
                    <strong>{p.name}</strong>
                  </div>
                </Link>
                <div className="imeta">
                  {p.platform && <span className="tag">{platformLabel(p.platform)}</span>}
                  <span>{p.teams.map((t) => t.slug).join(", ") || "No team"}</span>
                </div>
              </div>
              <div className="age">{p.firstEvent ? `First event ${timeAgo(p.firstEvent)}` : "No events yet"}</div>
            </div>
          ))}
        </div>
      )}
      {creating && <NewProject org={org} onClose={() => setCreating(false)} />}
    </>
  );
}
