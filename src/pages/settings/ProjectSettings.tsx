import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyButton } from "../../components/Copy";
import { Dialog } from "../../components/Dialog";
import { errorMessage } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import {
  useCreateKey,
  useDeleteKey,
  useDeleteProject,
  useOrgDetail,
  useOrgProjects,
  useProjectKeys,
  useUpdateProject,
} from "../../lib/queries";
import { PLATFORMS, can, platformLabel } from "../../lib/settings";
import type { ProjectDetail, ProjectKey } from "../../lib/types";
import { ProjectAlerts } from "./ProjectAlerts";

function KeyCard({ k, org, slug, editable, last }: { k: ProjectKey; org: string; slug: string; editable: boolean; last: boolean }) {
  const remove = useDeleteKey(org, slug);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="keycard">
      <div className="keytop">
        <strong>{k.label || "Default key"}</strong>
        <span className="soft">created {timeAgo(k.dateCreated)}</span>
        {editable && (
          <div className="keyacts">
            <button className="link-btn tight danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="dsn">
        <code>{k.dsn.public}</code>
        <CopyButton text={k.dsn.public} label="Copy DSN" />
      </div>
      {confirming && (
        <Dialog title="Delete this key?" narrow onClose={() => setConfirming(false)}>
          <p className="dlg-text">
            Anything still using this DSN will stop sending events to the project.
            {last && " This is the project's only key, so nothing will be able to send until you add another."}
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
              onClick={() => remove.mutate(k.id, { onSuccess: () => setConfirming(false) })}
            >
              {remove.isPending ? "Deleting…" : "Delete key"}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}

function AddKey({ org, slug, onClose }: { org: string; slug: string; onClose: () => void }) {
  const create = useCreateKey(org, slug);
  const [label, setLabel] = useState("");
  return (
    <Dialog title="Add a key" narrow onClose={onClose}>
      <form
        className="mform"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(label.trim(), { onSuccess: onClose });
        }}
      >
        <label className="fld">
          Label <span className="opt">optional</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mobile app" autoFocus />
          <small>Keys can't be renamed later, so pick something you'll recognise.</small>
        </label>
        {create.isError && (
          <p className="form-problem" role="alert">
            {errorMessage(create.error)}
          </p>
        )}
        <footer className="dlg-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add key"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function Keys({ org, slug, editable }: { org: string; slug: string; editable: boolean }) {
  const keys = useProjectKeys(org, slug);
  const [adding, setAdding] = useState(false);
  const list = keys.data ?? [];
  return (
    <section>
      <div className="shead-row">
        <h3 className="sec">Client keys (DSN)</h3>
        {editable && (
          <button className="btn sm" onClick={() => setAdding(true)}>
            Add key
          </button>
        )}
      </div>
      <p className="hint">Put a DSN in your app's SDK setup and its errors will land in this project.</p>
      {keys.isLoading ? (
        <div className="skel" style={{ height: 70 }} />
      ) : list.length === 0 ? (
        <div className="card cpad soft">No keys. Add one to start receiving events.</div>
      ) : (
        <div className="card">
          {list.map((k) => (
            <KeyCard key={k.id} k={k} org={org} slug={slug} editable={editable} last={list.length === 1} />
          ))}
        </div>
      )}
      {adding && <AddKey org={org} slug={slug} onClose={() => setAdding(false)} />}
    </section>
  );
}

function Details({ project, org, editable }: { project: ProjectDetail; org: string; editable: boolean }) {
  const update = useUpdateProject(org, project.slug);
  const [name, setName] = useState(project.name);
  const [platform, setPlatform] = useState(project.platform ?? "");
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== project.name || (platform || null) !== project.platform;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate({ name: name.trim(), platform: platform || null }, { onSuccess: () => setSaved(true) });
  };

  const known = PLATFORMS.some((p) => p.id === platform);
  return (
    <section>
      <h3 className="sec">Details</h3>
      <form className="card sform" onSubmit={submit}>
        <label className="fld">
          Name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            disabled={!editable}
          />
        </label>
        <label className="fld">
          Platform
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setSaved(false);
            }}
            disabled={!editable}
          >
            <option value="">Not set</option>
            {!known && platform && <option value={platform}>{platformLabel(platform)}</option>}
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="kv">
          <span>URL name</span>
          <b className="mono">{project.slug}</b>
        </div>
        <div className="kv">
          <span>Teams</span>
          <b>{project.teams.map((t) => t.slug).join(", ") || "None"}</b>
        </div>
        <div className="kv">
          <span>Created</span>
          <b>{timeAgo(project.dateCreated)}</b>
        </div>
        {update.isError && (
          <p className="form-problem" role="alert">
            {errorMessage(update.error)}
          </p>
        )}
        {editable && (
          <div className="sform-foot">
            {saved && <span className="saved">Saved</span>}
            <button className="btn pri" disabled={!dirty || !name.trim() || update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function Danger({ project, org }: { project: ProjectDetail; org: string }) {
  const remove = useDeleteProject(org, project.slug);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <section>
      <h3 className="sec">Danger zone</h3>
      <div className="card sform danger-zone">
        <div className="dz-row">
          <div>
            <strong>Delete this project</strong>
            <p className="hint" style={{ margin: "2px 0 0" }}>
              Its issues, events and keys are removed for good.
            </p>
          </div>
          <button className="btn danger" onClick={() => setOpen(true)}>
            Delete project
          </button>
        </div>
      </div>
      {open && (
        <Dialog title="Delete project?" narrow onClose={() => setOpen(false)}>
          <p className="dlg-text">
            This removes <b>{project.name}</b> and everything in it. Type the project name to confirm.
          </p>
          <label className="fld" style={{ marginTop: 14 }}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={project.name} autoFocus />
          </label>
          {remove.isError && (
            <p className="form-problem" role="alert" style={{ marginTop: 12 }}>
              {errorMessage(remove.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn danger solid"
              disabled={typed !== project.name || remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: () => navigate(`/${org}/settings/projects`) })}
            >
              {remove.isPending ? "Deleting…" : "Delete project"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}

export function ProjectSettings() {
  const { org = "", slug = "" } = useParams();
  const detail = useOrgDetail(org);
  const list = useOrgProjects(org);

  if (detail.isLoading || list.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  const project = list.data?.find((p) => p.slug === slug);
  if (!detail.data || !project) {
    return (
      <div className="err-box" role="alert">
        Couldn't find that project. <Link to={`/${org}/settings/projects`}>Back to projects</Link>
      </div>
    );
  }
  const editable = can(detail.data.access, "project:write");

  return (
    <>
      <div className="crumb">
        <Link to={`/${org}/settings/projects`}>Projects</Link> / {project.name}
      </div>
      <h2 className="shead">{project.name}</h2>
      <div className="sstack">
        <Keys org={org} slug={slug} editable={editable} />
        <ProjectAlerts org={org} slug={slug} editable={editable} admin={can(detail.data.access, "project:admin")} />
        <Details key={project.slug} project={project} org={org} editable={editable} />
        {can(detail.data.access, "project:admin") && <Danger project={project} org={org} />}
      </div>
    </>
  );
}
