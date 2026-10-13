import { useState, type FormEvent } from "react";
import { CopyButton } from "../../components/Copy";
import { Dialog } from "../../components/Dialog";
import {
  READ_SCOPES,
  TOKEN_SCOPES,
  useApiTokens,
  useCreateToken,
  useDeleteToken,
  type ApiToken,
} from "../../lib/account";
import { errorMessage } from "../../lib/api";
import { timeAgo } from "../../lib/format";

function mask(token: string) {
  return `${token.slice(0, 4)}${"•".repeat(16)}${token.slice(-4)}`;
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateToken();
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(READ_SCOPES);
  const [problem, setProblem] = useState("");

  const toggle = (s: string) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    if (!label.trim()) return setProblem("Give the token a name so you can recognise it later.");
    if (scopes.length === 0) return setProblem("Pick at least one permission.");
    create.mutate({ label: label.trim(), scopes }, { onSuccess: onClose, onError: (err) => setProblem(errorMessage(err)) });
  };

  return (
    <Dialog title="New API token" onClose={onClose}>
      <form className="mform" onSubmit={submit} noValidate>
        <label className="fld">
          Name
          <input value={label} maxLength={255} onChange={(e) => setLabel(e.target.value)} placeholder="CI release script" autoFocus />
        </label>
        <fieldset className="fset">
          <legend>Permissions</legend>
          <div className="scopes">
            {TOKEN_SCOPES.map((g) => (
              <div key={g.group} className="scope-group">
                <b>{g.group}</b>
                {g.scopes.map((s) => (
                  <label key={s} className="chk">
                    <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} />
                    {s.split(":")[1]}
                  </label>
                ))}
              </div>
            ))}
          </div>
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
          <button className="btn pri" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create token"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function TokenRow({ t, onDelete }: { t: ApiToken; onDelete: (t: ApiToken) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="row srow tokrow">
      <div style={{ minWidth: 0 }}>
        <div className="ititle">
          <strong>{t.label}</strong>
        </div>
        <div className="dsn" style={{ marginTop: 6 }}>
          <code>{shown ? t.token : mask(t.token)}</code>
        </div>
        <div className="imeta">
          <span>created {timeAgo(t.created)}</span>
          <span>{t.scopes.length === 1 ? "1 permission" : `${t.scopes.length} permissions`}</span>
        </div>
        <div className="scope-tags">
          {t.scopes.map((s) => (
            <span key={s} className="tag">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="keyacts">
        <button className="link-btn tight" onClick={() => setShown((v) => !v)}>
          {shown ? "Hide" : "Reveal"}
        </button>
        <CopyButton text={t.token} />
        <button className="link-btn tight danger" onClick={() => onDelete(t)}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function Tokens() {
  const tokens = useApiTokens();
  const remove = useDeleteToken();
  const [creating, setCreating] = useState(false);
  const [doomed, setDoomed] = useState<ApiToken | null>(null);

  return (
    <div className="stack">
      <div className="shead-row">
        <h2 className="shead">API tokens</h2>
        <button className="btn pri sm" onClick={() => setCreating(true)}>
          New token
        </button>
      </div>
      <p className="hint">
        Tokens let scripts and tools act as you, with only the permissions you give them. Treat them like passwords.
      </p>

      {tokens.isLoading ? (
        <div className="skel" style={{ height: 96 }} />
      ) : tokens.isError ? (
        <div className="err-box">{errorMessage(tokens.error)}</div>
      ) : tokens.data!.length === 0 ? (
        <div className="card sform">
          <p className="hint" style={{ margin: 0 }}>
            No tokens yet.
          </p>
        </div>
      ) : (
        <div className="card table">
          {tokens.data!.map((t) => (
            <TokenRow key={t.id} t={t} onDelete={setDoomed} />
          ))}
        </div>
      )}

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {doomed && (
        <Dialog title="Delete this token?" narrow onClose={() => setDoomed(null)}>
          <p className="dlg-text">
            Anything using <strong>{doomed.label}</strong> stops working straight away.
          </p>
          {remove.isError && (
            <p className="form-problem" role="alert">
              {errorMessage(remove.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={() => setDoomed(null)}>
              Keep it
            </button>
            <button
              className="btn danger solid"
              disabled={remove.isPending}
              onClick={() => remove.mutate(doomed.id, { onSuccess: () => setDoomed(null) })}
            >
              {remove.isPending ? "Deleting…" : "Delete token"}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
