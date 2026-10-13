import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../../components/Dialog";
import {
  useDeleteAccount,
  useNotificationPrefs,
  useSetSubscribeByDefault,
  useUpdateProfile,
  useUser,
  type UserDetail,
} from "../../lib/account";
import { errorMessage } from "../../lib/api";
import { timeAgo } from "../../lib/format";

const ZONES: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
const SYSTEM_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function Details({ user }: { user: UserDetail }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name);
  const [zone, setZone] = useState(user.options.timezone ?? "");
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== user.name || zone !== (user.options.timezone ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate(
      { name: name.trim(), options: { ...user.options, timezone: zone || null } },
      { onSuccess: () => setSaved(true) },
    );
  };

  // A zone the browser doesn't list (or one saved long ago) still has to be selectable.
  const zones = zone && !ZONES.includes(zone) ? [zone, ...ZONES] : ZONES;

  return (
    <form className="card sform" onSubmit={submit}>
      <label className="fld">
        Name <span className="opt">optional</span>
        <input
          value={name}
          maxLength={255}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <div className="kv">
        <span>Email</span>
        <b>{user.email}</b>
      </div>
      <label className="fld">
        Time zone
        <select
          value={zone}
          onChange={(e) => {
            setZone(e.target.value);
            setSaved(false);
          }}
        >
          <option value="">Use my device ({SYSTEM_ZONE})</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <small>Used for dates in emails and in the classic app.</small>
      </label>
      <div className="kv">
        <span>Joined</span>
        <b>{timeAgo(user.dateJoined)}</b>
      </div>
      {update.isError && (
        <p className="form-problem" role="alert">
          {errorMessage(update.error)}
        </p>
      )}
      <div className="sform-foot">
        {saved && <span className="saved">Saved</span>}
        <button className="btn pri" disabled={!dirty || update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Alerts() {
  const prefs = useNotificationPrefs();
  const set = useSetSubscribeByDefault();
  const on = prefs.data?.subscribeByDefault;
  return (
    <section>
      <h3 className="sec">Notifications</h3>
      <div className="card sform">
        <div className="dz-row">
          <div>
            <strong>Send me project alerts</strong>
            <p className="hint" style={{ margin: "2px 0 0" }}>
              The default for projects you can see. Each alert still has to be set up on its project.
            </p>
          </div>
          <div className="seg" role="group" aria-label="Send me project alerts">
            <button className={on ? "on" : ""} disabled={set.isPending || on === undefined} onClick={() => set.mutate(true)}>
              On
            </button>
            <button className={on === false ? "on" : ""} disabled={set.isPending || on === undefined} onClick={() => set.mutate(false)}>
              Off
            </button>
          </div>
        </div>
        {(prefs.isError || set.isError) && (
          <p className="form-problem" role="alert">
            {errorMessage(set.error ?? prefs.error)}
          </p>
        )}
      </div>
    </section>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const remove = useDeleteAccount();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const confirm = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
        qc.setQueryData(["session"], null);
        navigate("/login", { replace: true, state: { notice: "Your account was deleted." } });
      },
    });

  return (
    <section>
      <h3 className="sec">Danger zone</h3>
      <div className="card sform danger-zone">
        <div className="dz-row">
          <div>
            <strong>Delete my account</strong>
            <p className="hint" style={{ margin: "2px 0 0" }}>
              You lose access to every organization. Owners must transfer or delete theirs first.
            </p>
          </div>
          <button className="btn danger" onClick={() => setOpen(true)}>
            Delete account
          </button>
        </div>
      </div>
      {open && (
        <Dialog title="Delete your account?" narrow onClose={() => setOpen(false)}>
          <p className="dlg-text">This can't be undone. Type your email to confirm.</p>
          <label className="fld" style={{ marginTop: 12 }}>
            Email
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} autoFocus />
          </label>
          {remove.isError && (
            <p className="form-problem" role="alert">
              {errorMessage(remove.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={() => setOpen(false)}>
              Keep my account
            </button>
            <button
              className="btn danger solid"
              disabled={remove.isPending || typed.trim().toLowerCase() !== email.toLowerCase()}
              onClick={confirm}
            >
              {remove.isPending ? "Deleting…" : "Delete account"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}

export function Profile() {
  const user = useUser();
  if (user.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!user.data) return <div className="err-box">Couldn't load your profile.</div>;
  return (
    <div className="stack">
      <h2 className="shead">Profile</h2>
      <Details user={user.data} />
      <Alerts />
      <DeleteAccount email={user.data.email} />
    </div>
  );
}
