import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/api";
import { useProjects, useSaveMonitor } from "../lib/queries";
import type { Monitor, MonitorInput, MonitorType } from "../lib/types";
import { MONITOR_TYPES, intervalLabel } from "../lib/uptime";
import { Dialog } from "./Dialog";

const INTERVALS = [30, 60, 120, 300, 600, 1800, 3600, 86400];
const HTTP_TYPES: MonitorType[] = ["GET", "POST", "Ping"];

const URL_HINTS: Record<MonitorType, string> = {
  GET: "https://example.com/health",
  POST: "https://example.com/api/ping",
  Ping: "https://example.com",
  "TCP Port": "db.example.com:5432",
  SSL: "https://example.com",
  Heartbeat: "",
};

export function MonitorForm({
  org,
  monitor,
  onClose,
  onSaved,
}: {
  org: string;
  monitor?: Monitor;
  onClose: () => void;
  onSaved?: (saved: Monitor) => void;
}) {
  const projects = useProjects(org);
  const save = useSaveMonitor(org, monitor?.id);

  const [name, setName] = useState(monitor?.name ?? "");
  const [type, setType] = useState<MonitorType>(monitor?.monitorType ?? "GET");
  const [url, setUrl] = useState(monitor?.url ?? "");
  const [status, setStatus] = useState(String(monitor?.expectedStatus ?? 200));
  const [body, setBody] = useState(monitor?.expectedBody ?? "");
  const [interval, setIntervalSecs] = useState(monitor?.interval ?? 60);
  const [timeout, setTimeoutSecs] = useState(monitor?.timeout ? String(monitor.timeout) : "");
  const [threshold, setThreshold] = useState(String(monitor?.confirmationThreshold ?? 1));
  const [project, setProject] = useState(monitor?.projectID ?? "");
  const [problem, setProblem] = useState("");

  const isHttp = HTTP_TYPES.includes(type);
  const wantsStatus = type === "GET" || type === "POST";
  const intervals = INTERVALS.includes(interval) ? INTERVALS : [...INTERVALS, interval].sort((a, b) => a - b);
  const hint = MONITOR_TYPES.find((t) => t.id === type)?.hint;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    if (!name.trim()) return setProblem("Give the monitor a name.");
    if (type !== "Heartbeat" && !url.trim()) {
      return setProblem(type === "TCP Port" ? "Enter a host and port, like db.example.com:5432." : "Enter the URL to watch.");
    }
    const input: MonitorInput = {
      name: name.trim(),
      monitorType: type,
      url: type === "Heartbeat" ? "" : url.trim(),
      interval,
      timeout: isHttp && timeout ? Number(timeout) : null,
      expectedStatus: wantsStatus ? Number(status) || 200 : null,
      expectedBody: isHttp ? body : "",
      confirmationThreshold: Math.max(1, Number(threshold) || 1),
      project: project || null,
      environmentId: monitor?.environmentID ?? null,
    };
    save.mutate(input, {
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
      onError: (err) => setProblem(errorMessage(err)),
    });
  };

  return (
    <Dialog title={monitor ? "Edit monitor" : "New monitor"} onClose={onClose}>
      <form onSubmit={submit} noValidate className="mform">
        <label className="fld">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing site" autoFocus />
        </label>

        <label className="fld">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as MonitorType)}>
            {MONITOR_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {hint && <small>{hint}</small>}
        </label>

        {type !== "Heartbeat" && (
          <label className="fld">
            {type === "TCP Port" ? "Host and port" : "URL"}
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={URL_HINTS[type]}
              spellCheck={false}
              inputMode="url"
            />
          </label>
        )}

        <div className="two">
          <label className="fld">
            {type === "Heartbeat" ? "Expect a check-in every" : "Check every"}
            <select value={interval} onChange={(e) => setIntervalSecs(Number(e.target.value))}>
              {intervals.map((s) => (
                <option key={s} value={s}>
                  {intervalLabel(s)}
                </option>
              ))}
            </select>
          </label>
          {wantsStatus && (
            <label className="fld">
              Expected status
              <input value={status} onChange={(e) => setStatus(e.target.value)} inputMode="numeric" />
            </label>
          )}
        </div>

        {isHttp && (
          <label className="fld">
            Response must contain <span className="opt">optional</span>
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="OK" />
          </label>
        )}

        <div className="two">
          {isHttp && (
            <label className="fld">
              Timeout (seconds) <span className="opt">optional</span>
              <input
                value={timeout}
                onChange={(e) => setTimeoutSecs(e.target.value)}
                inputMode="numeric"
                placeholder="20"
              />
            </label>
          )}
          <label className="fld">
            Failures before alerting
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        <label className="fld">
          Project <span className="opt">optional</span>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">None</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
          <button className="btn pri" disabled={save.isPending}>
            {save.isPending ? "Saving…" : monitor ? "Save changes" : "Create monitor"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
