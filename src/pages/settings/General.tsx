import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { errorMessage } from "../../lib/api";
import { getAssistantSettings, updateAssistantSettings } from "../../lib/assistant";
import { timeAgo } from "../../lib/format";
import { useOrgDetail, useUpdateOrg } from "../../lib/queries";
import { can } from "../../lib/settings";

export function General() {
  const { org = "" } = useParams();
  const detail = useOrgDetail(org);
  const update = useUpdateOrg(org);
  const qc = useQueryClient();
  const aiCfg = useQuery({
    queryKey: ["assistant-settings", org],
    queryFn: () => getAssistantSettings(org),
    enabled: Boolean(org),
  });
  const saveAi = useMutation({
    mutationFn: (next: { enabled: boolean; scrubPii: boolean }) => updateAssistantSettings(org, next),
    // Write the saved values straight into the cache so the next toggle never reads stale ones.
    onSuccess: (saved) => {
      qc.setQueryData(["assistant-settings", org], saved);
    },
  });
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (detail.isLoading) return <div className="skel" style={{ width: "50%", height: 28 }} />;
  if (!detail.data) return <div className="err-box">Couldn't load the organization.</div>;

  const o = detail.data;
  const value = name ?? o.name;
  const editable = can(o.access, "org:write");
  const dirty = value.trim() !== o.name && value.trim() !== "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate(
      { name: value.trim() },
      {
        onSuccess: () => setSaved(true),
      },
    );
  };

  return (
    <>
      <h2 className="shead">General</h2>
      <form className="card sform" onSubmit={submit}>
        <label className="fld">
          Organization name
          <input
            value={value}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            disabled={!editable}
            maxLength={200}
          />
        </label>
        <div className="kv">
          <span>URL name</span>
          <b className="mono">{o.slug}</b>
        </div>
        <div className="kv">
          <span>Created</span>
          <b>{timeAgo(o.dateCreated)}</b>
        </div>
        <div className="kv">
          <span>Accepting events</span>
          <b>{o.isAcceptingEvents ? "Yes" : "Paused"}</b>
        </div>
        {update.isError && (
          <p className="form-problem" role="alert">
            {errorMessage(update.error)}
          </p>
        )}
        <div className="sform-foot">
          {saved && <span className="saved">Saved</span>}
          {editable ? (
            <button className="btn pri" disabled={!dirty || update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          ) : (
            <span className="soft">Only admins can change these.</span>
          )}
        </div>
      </form>

      {aiCfg.data && (
        <>
          <h2 className="shead" style={{ marginTop: 28 }}>
            AI Assistant
          </h2>
          <div className="card sform">
            <label className="kv" style={{ cursor: editable ? "pointer" : "default" }}>
              <span>Enable AI Assistant for {o.name}</span>
              <input
                type="checkbox"
                checked={aiCfg.data.enabled}
                disabled={!editable || saveAi.isPending}
                onChange={(e) =>
                  saveAi.mutate({
                    enabled: e.target.checked,
                    scrubPii: aiCfg.data.scrubPii,
                  })
                }
              />
            </label>
            <label className="kv" style={{ cursor: editable ? "pointer" : "default" }}>
              <span>Reduce personal data sent with telemetry</span>
              <input
                type="checkbox"
                checked={aiCfg.data.scrubPii}
                disabled={!editable || saveAi.isPending || !aiCfg.data.enabled}
                onChange={(e) =>
                  saveAi.mutate({
                    enabled: aiCfg.data.enabled,
                    scrubPii: e.target.checked,
                  })
                }
              />
            </label>
            <p className="hint">
              The assistant sends selected telemetry and your messages to an external AI provider.
              Sensitive data is filtered on a best-effort basis; review what you share.
            </p>
          </div>
        </>
      )}
    </>
  );
}
