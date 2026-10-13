import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/Dialog";
import { errorMessage } from "../../lib/api";
import {
  useAlerts,
  useDeleteAlert,
  useSaveAlert,
  useTestAlert,
  type AlertInput,
  type AlertTestResult,
} from "../../lib/queries";
import { RECIPIENTS, describeTrigger, recipientLabel } from "../../lib/settings";
import type { ProjectAlert } from "../../lib/types";

interface RecipientDraft {
  recipientType: string;
  url: string;
  tagsToAdd: string[];
}

const MAX_SMALLINT = 32767;

function AlertDialog({
  org,
  slug,
  alert,
  onClose,
}: {
  org: string;
  slug: string;
  alert?: ProjectAlert;
  onClose: () => void;
}) {
  const save = useSaveAlert(org, slug, alert?.id);
  const [name, setName] = useState(alert?.name ?? "");
  const [errorsOn, setErrorsOn] = useState(alert ? !!(alert.quantity && alert.timespanMinutes) : true);
  const [quantity, setQuantity] = useState(String(alert?.quantity ?? 1));
  const [minutes, setMinutes] = useState(String(alert?.timespanMinutes ?? 1));
  const [uptime, setUptime] = useState(alert?.uptime ?? false);
  const [environments, setEnvironments] = useState((alert?.environments ?? []).join(", "));
  const [recipients, setRecipients] = useState<RecipientDraft[]>(
    alert?.alertRecipients.map((r) => ({
      recipientType: r.recipientType,
      url: r.url,
      tagsToAdd: r.tagsToAdd ?? [],
    })) ?? [{ recipientType: "email", url: "", tagsToAdd: [] }],
  );
  const [problem, setProblem] = useState("");

  const patch = (i: number, change: Partial<RecipientDraft>) =>
    setRecipients((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    const q = Number(quantity);
    const m = Number(minutes);
    if (!errorsOn && !uptime) return setProblem("Pick at least one thing to alert on.");
    if (errorsOn && !(Number.isInteger(q) && q >= 1 && q <= MAX_SMALLINT)) {
      return setProblem("Enter how many events (1 or more).");
    }
    if (errorsOn && !(Number.isInteger(m) && m >= 1 && m <= MAX_SMALLINT)) {
      return setProblem("Enter how many minutes (1 or more).");
    }
    if (recipients.length === 0) return setProblem("Add at least one place to send the alert.");
    for (const r of recipients) {
      if (r.recipientType !== "email" && !/^https?:\/\/\S+$/.test(r.url.trim())) {
        return setProblem(`Enter a full URL (starting with https://) for ${recipientLabel(r.recipientType)}.`);
      }
    }
    const input: AlertInput = {
      name: name.trim(),
      quantity: errorsOn ? q : null,
      timespanMinutes: errorsOn ? m : null,
      uptime,
      environments: environments
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      alertRecipients: recipients.map((r) => ({
        recipientType: r.recipientType,
        url: r.recipientType === "email" ? "" : r.url.trim(),
        tagsToAdd: r.tagsToAdd,
      })),
    };
    save.mutate(input, { onSuccess: onClose, onError: (err) => setProblem(errorMessage(err)) });
  };

  return (
    <Dialog title={alert ? "Edit alert" : "New alert"} onClose={onClose}>
      <form className="mform" onSubmit={submit} noValidate>
        <label className="fld">
          Name <span className="opt">optional</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Checkout errors" autoFocus />
        </label>

        <fieldset className="fset">
          <legend>Alert me when</legend>
          <label className="chk">
            <input type="checkbox" checked={errorsOn} onChange={(e) => setErrorsOn(e.target.checked)} />
            <span>
              An issue gets
              <input
                className="mini"
                aria-label="Number of events"
                value={quantity}
                disabled={!errorsOn}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
              />
              events within
              <input
                className="mini"
                aria-label="Number of minutes"
                value={minutes}
                disabled={!errorsOn}
                onChange={(e) => setMinutes(e.target.value)}
                inputMode="numeric"
              />
              minutes
            </span>
          </label>
          <label className="chk">
            <input type="checkbox" checked={uptime} onChange={(e) => setUptime(e.target.checked)} />
            <span>An uptime check fails</span>
          </label>
        </fieldset>

        <label className="fld">
          Only for environments <span className="opt">optional</span>
          <input
            value={environments}
            onChange={(e) => setEnvironments(e.target.value)}
            placeholder="production, staging"
          />
          <small>Comma separated. Leave empty to cover every environment.</small>
        </label>

        <fieldset className="fset">
          <legend>Send it to</legend>
          {recipients.map((r, i) => (
            <div className="recip" key={i}>
              <select
                aria-label="Where to send"
                value={r.recipientType}
                onChange={(e) => patch(i, { recipientType: e.target.value })}
              >
                {RECIPIENTS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {r.recipientType === "email" ? (
                <span className="soft grow-1">Everyone on the project's teams</span>
              ) : (
                <input
                  aria-label="Webhook URL"
                  value={r.url}
                  onChange={(e) => patch(i, { url: e.target.value })}
                  placeholder="https://hooks.example.com/…"
                  spellCheck={false}
                />
              )}
              <button
                type="button"
                className="x"
                aria-label="Remove recipient"
                onClick={() => setRecipients((rs) => rs.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn tight"
            onClick={() =>
              setRecipients((rs) => [
                ...rs,
                { recipientType: rs.some((r) => r.recipientType === "email") ? "slack" : "email", url: "", tagsToAdd: [] },
              ])
            }
          >
            + Add another
          </button>
        </fieldset>

        {problem && (
          <p className="form-problem" role="alert">
            {problem}
          </p>
        )}
        <footer className="dlg-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={save.isPending}>
            {save.isPending ? "Saving…" : alert ? "Save changes" : "Create alert"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function AlertRow({
  a,
  org,
  slug,
  editable,
  admin,
}: {
  a: ProjectAlert;
  org: string;
  slug: string;
  editable: boolean;
  admin: boolean;
}) {
  const remove = useDeleteAlert(org, slug);
  const test = useTestAlert(org, slug);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<AlertTestResult[] | null>(null);
  const hasZulip = a.alertRecipients.some((r) => r.recipientType === "zulip");
  const testable = a.alertRecipients.some((r) => r.recipientType !== "email");

  return (
    <div className="alertrow">
      <div className="alerttop">
        <div style={{ minWidth: 0 }}>
          <strong>{a.name || `Alert ${a.id}`}</strong>
          <div className="soft">{describeTrigger(a)}</div>
        </div>
        <div className="keyacts">
          {editable && testable && (
            <button
              className="link-btn tight"
              disabled={test.isPending}
              onClick={() => test.mutate(a.id, { onSuccess: setResults })}
            >
              {test.isPending ? "Sending…" : "Send test"}
            </button>
          )}
          {editable && !hasZulip && (
            <button className="link-btn tight" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {admin && (
            <button className="link-btn tight danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
        </div>
      </div>
      <div className="chips">
        {a.alertRecipients.map((r) => (
          <span key={r.id} className="tag">
            {recipientLabel(r.recipientType)}
          </span>
        ))}
        {a.environments.map((e) => (
          <span key={e} className="tag env">
            {e}
          </span>
        ))}
        {hasZulip && <span className="soft">Uses Zulip, which can't be edited here yet.</span>}
      </div>
      {test.isError && (
        <p className="form-problem" role="alert">
          {errorMessage(test.error)}
        </p>
      )}
      {results && (
        <ul className="testres">
          {results.map((r, i) => (
            <li key={i} className={r.status}>
              <b>{recipientLabel(r.recipientType)}</b>{" "}
              {r.status === "sent" ? "got the test message" : r.status === "skipped" ? "skipped" : `failed: ${r.message}`}
            </li>
          ))}
        </ul>
      )}
      {editing && <AlertDialog org={org} slug={slug} alert={a} onClose={() => setEditing(false)} />}
      {confirming && (
        <Dialog title="Delete this alert?" narrow onClose={() => setConfirming(false)}>
          <p className="dlg-text">You'll stop getting notifications from it.</p>
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
              onClick={() => remove.mutate(a.id, { onSuccess: () => setConfirming(false) })}
            >
              {remove.isPending ? "Deleting…" : "Delete alert"}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}

export function ProjectAlerts({
  org,
  slug,
  editable,
  admin,
}: {
  org: string;
  slug: string;
  editable: boolean;
  admin: boolean;
}) {
  const alerts = useAlerts(org, slug);
  const [creating, setCreating] = useState(false);
  const list = alerts.data ?? [];

  return (
    <section>
      <div className="shead-row">
        <h3 className="sec">Alerts</h3>
        {editable && (
          <button className="btn sm" onClick={() => setCreating(true)}>
            New alert
          </button>
        )}
      </div>
      <p className="hint">Get told when something in this project needs attention.</p>
      {alerts.isLoading ? (
        <div className="skel" style={{ height: 70 }} />
      ) : list.length === 0 ? (
        <div className="card cpad soft">No alerts yet. Create one to be notified by email, Slack and more.</div>
      ) : (
        <div className="card">
          {list.map((a) => (
            <AlertRow key={a.id} a={a} org={org} slug={slug} editable={editable} admin={admin} />
          ))}
        </div>
      )}
      {creating && <AlertDialog org={org} slug={slug} onClose={() => setCreating(false)} />}
    </section>
  );
}
