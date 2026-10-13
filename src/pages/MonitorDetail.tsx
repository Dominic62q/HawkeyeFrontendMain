import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Dialog } from "../components/Dialog";
import { MonitorForm } from "../components/MonitorForm";
import { CheckBars, ResponseChart } from "../components/UptimeCharts";
import { errorMessage } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useDeleteMonitor, useMonitor, useMonitorChanges } from "../lib/queries";
import type { Monitor, MonitorCheck } from "../lib/types";
import {
  MONITOR_TYPES,
  avgResponse,
  formatMs,
  formatPct,
  intervalLabel,
  reasonLabel,
  span,
  stateOf,
  uptimePct,
} from "../lib/uptime";

interface Incident {
  startedAt: string;
  reason: number | null;
  recoveredAt: string | null;
}

/** Pair each "went down" check with the "recovered" check that followed it. */
function incidents(changes: MonitorCheck[]): Incident[] {
  const chronological = [...changes].sort((a, b) => a.startCheck.localeCompare(b.startCheck));
  const out: Incident[] = [];
  for (const c of chronological) {
    if (!c.isUp) out.push({ startedAt: c.startCheck, reason: c.reason, recoveredAt: null });
    else if (out.length && out[out.length - 1].recoveredAt === null) out[out.length - 1].recoveredAt = c.startCheck;
  }
  return out.reverse();
}

function Config({ m }: { m: Monitor }) {
  const label = MONITOR_TYPES.find((t) => t.id === m.monitorType)?.label ?? m.monitorType;
  const http = ["GET", "POST", "Ping"].includes(m.monitorType);
  return (
    <div className="card panel">
      <h3 className="sec">Configuration</h3>
      <div className="kv"><span>Type</span><b>{label}</b></div>
      {m.monitorType !== "Heartbeat" && <div className="kv"><span>Target</span><b className="mono">{m.url}</b></div>}
      <div className="kv">
        <span>{m.monitorType === "Heartbeat" ? "Check-in every" : "Checks every"}</span>
        <b>{intervalLabel(m.interval)}</b>
      </div>
      {(m.monitorType === "GET" || m.monitorType === "POST") && (
        <div className="kv"><span>Expected status</span><b>{m.expectedStatus ?? 200}</b></div>
      )}
      {http && m.expectedBody && <div className="kv"><span>Must contain</span><b className="mono">{m.expectedBody}</b></div>}
      {http && <div className="kv"><span>Timeout</span><b>{m.timeout ? `${m.timeout}s` : "20s (default)"}</b></div>}
      <div className="kv"><span>Failures before alert</span><b>{m.confirmationThreshold}</b></div>
      {m.projectName && <div className="kv"><span>Project</span><b>{m.projectName}</b></div>}
      <div className="kv"><span>Created</span><b>{timeAgo(m.created)}</b></div>
    </div>
  );
}

function Heartbeat({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const curl = `curl -X POST ${url}`;
  return (
    <div className="card panel">
      <h3 className="sec">Check-in URL</h3>
      <p className="hb-note">Have your job send a POST here each time it succeeds.</p>
      <code className="hb-code">{curl}</code>
      <button
        className="btn"
        style={{ marginTop: 10 }}
        onClick={() => {
          void navigator.clipboard?.writeText(curl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        {copied ? "Copied" : "Copy command"}
      </button>
    </div>
  );
}

export function MonitorDetail() {
  const { org = "", id = "" } = useParams();
  const navigate = useNavigate();
  const monitor = useMonitor(org, id);
  const changes = useMonitorChanges(org, id);
  const remove = useDeleteMonitor(org);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (monitor.isLoading) {
    return (
      <div className="wrap" aria-busy="true">
        <div className="skel" style={{ width: "40%", height: 34 }} />
      </div>
    );
  }
  if (monitor.error || !monitor.data) {
    return (
      <div className="wrap">
        <div className="err-box" role="alert">
          Couldn't find that monitor. <Link to={`/${org}/uptime`}>Back to uptime</Link>
        </div>
      </div>
    );
  }

  const m = monitor.data;
  const state = stateOf(m);
  const pct = uptimePct(m.checks);
  const avg = avgResponse(m.checks);
  const hasTimes = m.checks.some((c) => c.responseTime != null);
  const history = incidents(changes.data ?? []);
  const rows = showAll ? m.checks : m.checks.slice(0, 10);
  const isUrl = /^https?:\/\//.test(m.url);

  const statusText =
    state === "pending" ? "Waiting for first check" : `${state === "up" ? "Up" : "Down"}${m.lastChange ? ` for ${span(m.lastChange)}` : ""}`;

  return (
    <div className="wrap">
      <div className="crumb">
        <Link to={`/${org}/uptime`}>Uptime</Link> / {m.name}
      </div>

      <div className="dh">
        <div>
          <div className="top">
            <span className={`dot ${state}`} />
            <span>{state === "up" ? "Operational" : state === "down" ? "Down" : "Pending"}</span>
            <span className="tag">{MONITOR_TYPES.find((t) => t.id === m.monitorType)?.label ?? m.monitorType}</span>
          </div>
          <h1>{m.name}</h1>
          {m.monitorType !== "Heartbeat" &&
            (isUrl ? (
              <a className="where link" href={m.url} target="_blank" rel="noreferrer noopener">
                {m.url} ↗
              </a>
            ) : (
              <div className="where">{m.url}</div>
            ))}
        </div>
        <div className="acts">
          <button className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn danger" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
      </div>

      <div className="strip card">
        <div>
          <span className="eyebrow">Status</span>
          <b className={state === "down" ? "bad" : state === "up" ? "good" : ""} style={{ fontSize: 17 }}>
            {statusText}
          </b>
        </div>
        <div>
          <span className="eyebrow">Uptime · last {m.checks.length || 60}</span>
          <b>{formatPct(pct)}</b>
        </div>
        <div>
          <span className="eyebrow">Avg response</span>
          <b>{formatMs(avg)}</b>
        </div>
        <div>
          <span className="eyebrow">Interval</span>
          <b>{intervalLabel(m.interval)}</b>
        </div>
      </div>

      <div className="cols">
        <div>
          {hasTimes && (
            <>
              <h3 className="sec">Response time</h3>
              <div className="card cpad" style={{ marginBottom: 24 }}>
                <ResponseChart checks={m.checks} />
              </div>
            </>
          )}

          <h3 className="sec">Recent checks</h3>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="cpad" style={{ paddingBottom: 6 }}>
              <CheckBars checks={m.checks} tall />
              <div className="axis">
                <span>older</span>
                <span>newer</span>
              </div>
            </div>
            {m.checks.length === 0 ? (
              <p className="cpad" style={{ color: "var(--mute)" }}>
                No checks have run yet.
              </p>
            ) : (
              <table className="ctable">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Result</th>
                    <th className="r">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.startCheck}>
                      <td title={new Date(c.startCheck).toLocaleString()}>{timeAgo(c.startCheck)}</td>
                      <td>
                        <span className={`st ${c.isUp ? "up" : "down"}`}>
                          {c.isUp ? "Passed" : reasonLabel(c.reason)}
                        </span>
                      </td>
                      <td className="r mono">{formatMs(c.responseTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {m.checks.length > 10 && (
              <button className="link-btn" style={{ margin: "4px 16px 14px" }} onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show fewer" : `Show all ${m.checks.length}`}
              </button>
            )}
          </div>

          <h3 className="sec">Incidents</h3>
          <div className="card">
            {history.length === 0 ? (
              <p className="cpad" style={{ color: "var(--mute)" }}>
                No incidents recorded. Failures will show up here with how long they lasted.
              </p>
            ) : (
              <ul className="incidents">
                {history.map((i) => (
                  <li key={i.startedAt}>
                    <span className={`dot ${i.recoveredAt ? "up" : "down"}`} />
                    <div>
                      <b>{reasonLabel(i.reason)}</b>
                      <small>
                        {new Date(i.startedAt).toLocaleString()} ·{" "}
                        {i.recoveredAt ? `down for ${span(i.startedAt, new Date(i.recoveredAt).getTime())}` : "still down"}
                      </small>
                    </div>
                    <span className="age">{timeAgo(i.startedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside>
          <Config m={m} />
          {m.heartbeatEndpoint && <Heartbeat url={m.heartbeatEndpoint} />}
        </aside>
      </div>

      {editing && <MonitorForm org={org} monitor={m} onClose={() => setEditing(false)} />}
      {confirming && (
        <Dialog title="Delete this monitor?" narrow onClose={() => setConfirming(false)}>
          <p className="dlg-text">
            “{m.name}” and its check history will be removed. This can't be undone.
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
              onClick={() => remove.mutate(m.id, { onSuccess: () => navigate(`/${org}/uptime`) })}
            >
              {remove.isPending ? "Deleting…" : "Delete monitor"}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
