import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { CopyButton } from "../../components/Copy";
import { Dialog } from "../../components/Dialog";
import {
  useActivateTotp,
  useChangePassword,
  useConfirmRecoveryCodes,
  useDeactivateTotp,
  useDisconnectIdentity,
  usePreviewRecoveryCodes,
  useRecoveryCodes,
  useTotp,
  useUser,
  type UserIdentity,
} from "../../lib/account";
import { errorMessage, splitErrors } from "../../lib/api";
import { timeAgo } from "../../lib/format";

const MIN_PASSWORD = 8;

const providerLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

function Password({ hasPassword }: { hasPassword: boolean }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    setSaved(false);
    if (hasPassword && !current) return setProblem("Enter your current password.");
    if (next.length < MIN_PASSWORD) return setProblem(`Use at least ${MIN_PASSWORD} characters for the new password.`);
    if (next !== again) return setProblem("The two new passwords don't match.");
    change.mutate(
      { currentPassword: hasPassword ? current : undefined, newPassword: next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setAgain("");
          setSaved(true);
        },
        onError: (err) => {
          const { form, fields } = splitErrors(err);
          setProblem(fields.current_password ?? fields.new_password ?? form);
        },
      },
    );
  };

  return (
    <section>
      <h3 className="sec">Password</h3>
      <form className="card sform" onSubmit={submit} noValidate>
        {/* Lets password managers file the new password under the right account. */}
        {hasPassword && (
          <label className="fld">
            Current password
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
        )}
        <label className="fld">
          {hasPassword ? "New password" : "Choose a password"}
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <small>At least {MIN_PASSWORD} characters.</small>
        </label>
        <label className="fld">
          Confirm new password
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        {problem && (
          <p className="form-problem" role="alert">
            {problem}
          </p>
        )}
        <div className="sform-foot">
          {saved && <span className="saved">Password updated</span>}
          <button className="btn pri" disabled={change.isPending}>
            {change.isPending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SetupDialog({ secret, url, onClose }: { secret: string; url: string; onClose: (done: boolean) => void }) {
  const activate = useActivateTotp();
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: 200 }).then((d) => live && setQr(d));
    return () => {
      live = false;
    };
  }, [url]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) return setProblem("Enter the 6 digit code from your app.");
    activate.mutate(clean, { onSuccess: () => onClose(true), onError: (err) => setProblem(errorMessage(err)) });
  };

  return (
    <Dialog title="Set up an authenticator app" onClose={() => onClose(false)}>
      <form className="mform" onSubmit={submit} noValidate>
        <p className="dlg-text">
          Scan this with an authenticator app such as 1Password, Authy or Google Authenticator. Then enter the code it
          shows.
        </p>
        <div className="qrbox">
          {qr ? <img src={qr} width={200} height={200} alt="QR code for your authenticator app" /> : <div className="skel" style={{ width: 200, height: 200 }} />}
          <div>
            <div className="soft">Can't scan it? Enter this key instead:</div>
            <div className="dsn" style={{ marginTop: 6 }}>
              <code>{secret}</code>
              <CopyButton text={secret} />
            </div>
          </div>
        </div>
        <label className="fld">
          6 digit code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000 000"
            autoFocus
          />
        </label>
        {problem && (
          <p className="form-problem" role="alert">
            {problem}
          </p>
        )}
        <footer className="dlg-foot">
          <button type="button" className="btn" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button className="btn pri" disabled={activate.isPending}>
            {activate.isPending ? "Checking…" : "Turn on"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function NewCodesDialog({ onClose }: { onClose: () => void }) {
  const preview = usePreviewRecoveryCodes();
  const confirm = useConfirmRecoveryCodes();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState("");
  const codes = preview.data;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    confirm.mutate(code.trim(), { onSuccess: onClose, onError: (err) => setProblem(errorMessage(err)) });
  };

  return (
    <Dialog title="New recovery codes" onClose={onClose}>
      {!codes ? (
        <>
          <p className="dlg-text">
            This makes a new set of codes and stops the old ones working. Nothing changes until you confirm that you've
            saved the new ones.
          </p>
          {preview.isError && (
            <p className="form-problem" role="alert">
              {errorMessage(preview.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn pri" disabled={preview.isPending} onClick={() => preview.mutate()}>
              {preview.isPending ? "Generating…" : "Generate codes"}
            </button>
          </footer>
        </>
      ) : (
        <form className="mform" onSubmit={submit} noValidate>
          <p className="dlg-text">Save these somewhere safe. Each one works once.</p>
          <div className="codes">
            {codes.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
          <div>
            <CopyButton text={codes.join("\n")} label="Copy all" />
          </div>
          <label className="fld">
            Type one of them to confirm
            <input value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} autoComplete="off" />
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
            <button className="btn pri" disabled={confirm.isPending || !code.trim()}>
              {confirm.isPending ? "Saving…" : "Use these codes"}
            </button>
          </footer>
        </form>
      )}
    </Dialog>
  );
}

function RecoveryCodes({ open, onToggle, onMake }: { open: boolean; onToggle: () => void; onMake: () => void }) {
  const codes = useRecoveryCodes(true);
  const data = codes.data;
  if (codes.isLoading) return <div className="skel" style={{ height: 40 }} />;
  if (!data) {
    return (
      <div className="subrow">
        <div className="dz-row">
          <div>
            <strong>Recovery codes</strong>
            <p className="hint" style={{ margin: "2px 0 0" }}>
              One-time codes that get you in if you lose your phone. You don't have any yet.
            </p>
          </div>
          <button className="btn pri sm" onClick={onMake}>
            Create codes
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="subrow">
      <div className="dz-row">
        <div>
          <strong>Recovery codes</strong>
          <p className="hint" style={{ margin: "2px 0 0" }}>
            {data.unusedCount} of {data.total} unused. Use one if you lose your phone.
          </p>
        </div>
        <div className="keyacts">
          {data.unused && (
            <button className="link-btn tight" onClick={onToggle}>
              {open ? "Hide" : "Show"}
            </button>
          )}
          <button className="link-btn tight" onClick={onMake}>
            Make new codes
          </button>
        </div>
      </div>
      {open && data.unused && (
        <>
          <div className="codes">
            {data.unused.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
          <div>
            <CopyButton text={data.unused.join("\n")} label="Copy all" />
          </div>
        </>
      )}
    </div>
  );
}

function TwoFactor() {
  const totp = useTotp();
  const off = useDeactivateTotp();
  const [setup, setSetup] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [makeCodes, setMakeCodes] = useState(false);
  const state = totp.data;

  return (
    <section>
      <h3 className="sec">Two-factor authentication</h3>
      <div className="card sform">
        {totp.isLoading ? (
          <div className="skel" style={{ height: 40 }} />
        ) : !state ? (
          <p className="form-problem" role="alert">
            {errorMessage(totp.error)}
          </p>
        ) : state.active ? (
          <>
            <div className="dz-row">
              <div>
                <div className="ititle">
                  <strong>Authenticator app</strong>
                  <span className="tag ok">On</span>
                </div>
                <p className="hint" style={{ margin: "2px 0 0" }}>
                  Set up {timeAgo(new Date(state.createdAt * 1000).toISOString())}
                  {state.lastUsedAt ? `, last used ${timeAgo(new Date(state.lastUsedAt * 1000).toISOString())}` : ""}.
                </p>
              </div>
              <button className="btn danger" onClick={() => setConfirmOff(true)}>
                Turn off
              </button>
            </div>
            <RecoveryCodes open={showCodes} onToggle={() => setShowCodes((v) => !v)} onMake={() => setMakeCodes(true)} />
          </>
        ) : (
          <div className="dz-row">
            <div>
              <strong>Authenticator app</strong>
              <p className="hint" style={{ margin: "2px 0 0" }}>
                Ask for a code from your phone when you sign in, on top of your password.
              </p>
            </div>
            <button className="btn pri" onClick={() => setSetup(true)}>
              Set up
            </button>
          </div>
        )}
      </div>

      {setup && state && !state.active && (
        <SetupDialog
          secret={state.secret}
          url={state.url}
          onClose={(done) => {
            setSetup(false);
            // Allauth makes no recovery codes on its own, so offer them straight away.
            if (done) setMakeCodes(true);
          }}
        />
      )}
      {makeCodes && (
        <NewCodesDialog
          onClose={() => {
            setMakeCodes(false);
            setShowCodes(true);
          }}
        />
      )}
      {confirmOff && (
        <Dialog title="Turn off two-factor authentication?" narrow onClose={() => setConfirmOff(false)}>
          <p className="dlg-text">Your account will be protected by your password alone, and your recovery codes stop working.</p>
          {off.isError && (
            <p className="form-problem" role="alert">
              {errorMessage(off.error)}
            </p>
          )}
          <footer className="dlg-foot">
            <button className="btn" onClick={() => setConfirmOff(false)}>
              Keep it on
            </button>
            <button
              className="btn danger solid"
              disabled={off.isPending}
              onClick={() => off.mutate(undefined, { onSuccess: () => setConfirmOff(false) })}
            >
              {off.isPending ? "Turning off…" : "Turn off"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}

function Identity({ id }: { id: UserIdentity }) {
  const disconnect = useDisconnectIdentity();
  return (
    <div className="row srow">
      <div style={{ minWidth: 0 }}>
        <div className="ititle">
          <strong>{providerLabel(id.provider)}</strong>
        </div>
        <div className="imeta">
          <span>{id.email ?? id.username ?? id.uid}</span>
          <span>last used {timeAgo(id.lastLogin)}</span>
        </div>
        {disconnect.isError && (
          <p className="form-problem" role="alert">
            {errorMessage(disconnect.error)}
          </p>
        )}
      </div>
      <div className="memacts">
        <button className="link-btn tight danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate(id)}>
          Disconnect
        </button>
      </div>
    </div>
  );
}

export function Security() {
  const user = useUser();
  if (user.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!user.data) return <div className="err-box">Couldn't load your account.</div>;
  return (
    <div className="stack">
      <h2 className="shead">Security</h2>
      <Password hasPassword={user.data.hasPasswordAuth} />
      <TwoFactor />
      {user.data.identities.length > 0 && (
        <section>
          <h3 className="sec">Connected accounts</h3>
          <div className="card table">
            {user.data.identities.map((i) => (
              <Identity key={i.id} id={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
