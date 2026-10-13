import { useState, type FormEvent } from "react";
import { errorMessage } from "../../lib/api";
import { useEmailActions, useUserEmails, type UserEmail } from "../../lib/account";

function EmailRow({ e, actions }: { e: UserEmail; actions: ReturnType<typeof useEmailActions> }) {
  const [sent, setSent] = useState(false);
  const busy = actions.makePrimary.isPending || actions.remove.isPending || actions.resend.isPending;
  const failed = [actions.makePrimary, actions.remove, actions.resend].find((m) => m.isError);
  return (
    <div className="row srow">
      <div style={{ minWidth: 0 }}>
        <div className="ititle">
          <strong>{e.email}</strong>
          {e.isPrimary && <span className="tag">Primary</span>}
          {!e.isVerified && <span className="tag new">Unverified</span>}
        </div>
        {!e.isVerified && <div className="imeta">Confirm it with the link we email you.</div>}
        {failed && (
          <p className="form-problem" role="alert">
            {errorMessage(failed.error)}
          </p>
        )}
      </div>
      <div className="memacts">
        {!e.isVerified && (
          <button
            className="link-btn tight"
            disabled={busy}
            onClick={() => actions.resend.mutate(e.email, { onSuccess: () => setSent(true) })}
          >
            {sent ? "Sent" : "Resend link"}
          </button>
        )}
        {e.isVerified && !e.isPrimary && (
          <button className="link-btn tight" disabled={busy} onClick={() => actions.makePrimary.mutate(e.email)}>
            Make primary
          </button>
        )}
        {!e.isPrimary && (
          <button className="link-btn tight danger" disabled={busy} onClick={() => actions.remove.mutate(e.email)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export function Emails() {
  const emails = useUserEmails();
  const actions = useEmailActions();
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState("");
  const [added, setAdded] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    setAdded("");
    const email = value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setProblem("Enter a valid email address.");
    actions.add.mutate(email, {
      onSuccess: () => {
        setValue("");
        setAdded(email);
      },
      onError: (err) => setProblem(errorMessage(err)),
    });
  };

  if (emails.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!emails.data) return <div className="err-box">Couldn't load your email addresses.</div>;

  return (
    <div className="stack">
      <h2 className="shead">Email addresses</h2>
      <p className="hint">Alerts and account email go to your primary address. Verify an address before you can make it primary.</p>
      <div className="card table">
        {emails.data.map((e) => (
          <EmailRow key={e.email} e={e} actions={actions} />
        ))}
      </div>

      <form className="card sform" onSubmit={submit} noValidate>
        <label className="fld">
          Add an address
          <input type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder="me@another.com" />
        </label>
        {problem && (
          <p className="form-problem" role="alert">
            {problem}
          </p>
        )}
        <div className="sform-foot">
          {added && <span className="saved">Confirmation sent to {added}</span>}
          <button className="btn pri" disabled={actions.add.isPending}>
            {actions.add.isPending ? "Adding…" : "Add address"}
          </button>
        </div>
      </form>
    </div>
  );
}
