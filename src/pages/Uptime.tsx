import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckBars } from "../components/UptimeCharts";
import { MonitorForm } from "../components/MonitorForm";
import { timeAgo } from "../lib/format";
import { useMonitors, type MonitorSort } from "../lib/queries";
import type { Monitor } from "../lib/types";
import { MONITOR_TYPES, formatPct, span, stateOf, uptimePct } from "../lib/uptime";

const SORTS: { id: MonitorSort; label: string }[] = [
  { id: "status", label: "Down first" },
  { id: "name", label: "Name" },
  { id: "-created", label: "Newest" },
];

type View = "all" | "down" | "up";

function typeLabel(m: Monitor): string {
  return MONITOR_TYPES.find((t) => t.id === m.monitorType)?.label ?? m.monitorType;
}

function StateText({ m }: { m: Monitor }) {
  const state = stateOf(m);
  if (state === "pending") return <span className="st pending">Waiting</span>;
  return (
    <span className={`st ${state}`}>
      {state === "up" ? "Up" : "Down"}
      {m.lastChange && <small> · {span(m.lastChange)}</small>}
    </span>
  );
}

function Row({ m, org }: { m: Monitor; org: string }) {
  const state = stateOf(m);
  return (
    <div className="row mrow">
      <div className="mname" style={{ minWidth: 0 }}>
        <Link className="rowlink" to={`/${org}/uptime/${m.id}`}>
          <div className="ititle">
            <span className={`dot ${state}`} />
            <strong>{m.name}</strong>
          </div>
        </Link>
        <div className="imeta">
          <span className="tag">{typeLabel(m)}</span>
          <span className="culprit">{m.monitorType === "Heartbeat" ? "Waits for check-ins" : m.url}</span>
        </div>
      </div>
      <div className="mbars">
        <CheckBars checks={m.checks} />
      </div>
      <div className="num">{formatPct(uptimePct(m.checks))}</div>
      <div className="mstate">
        <StateText m={m} />
      </div>
    </div>
  );
}

export function Uptime() {
  const { org = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const sort = (SORTS.find((s) => s.id === params.get("sort"))?.id ?? "status") as MonitorSort;
  const view = (["down", "up"].includes(params.get("view") ?? "") ? params.get("view") : "all") as View;
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, error, isLoading, isPlaceholderData, refetch } = useMonitors(org, sort);

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const monitors = data ?? [];
  const down = monitors.filter((m) => stateOf(m) === "down");
  const up = monitors.filter((m) => stateOf(m) === "up");
  const q = filter.trim().toLowerCase();
  const shown = monitors.filter(
    (m) =>
      (view === "all" || stateOf(m) === view) &&
      (!q || m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q)),
  );

  const percents = monitors.map((m) => uptimePct(m.checks)).filter((p): p is number => p !== null);
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null;
  const latest = monitors
    .filter((m) => m.lastChange)
    .sort((a, b) => (b.lastChange as string).localeCompare(a.lastChange as string))[0];

  const headline =
    monitors.length === 0
      ? "No monitors"
      : down.length > 0
        ? `${down.length} down`
        : up.length === monitors.length
          ? "All operational"
          : "Waiting for checks";

  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <h1>Uptime</h1>
          <p className="psub">
            {org} · {monitors.length} {monitors.length === 1 ? "monitor" : "monitors"}
          </p>
        </div>
        <button className="btn pri" onClick={() => setCreating(true)}>
          New monitor
        </button>
      </div>

      {monitors.length > 0 && (
        <section className="strip card" aria-label="Summary">
          <div>
            <span className="eyebrow">Status</span>
            <b className={down.length > 0 ? "bad" : up.length === monitors.length ? "good" : ""}>{headline}</b>
          </div>
          <div>
            <span className="eyebrow">Monitors</span>
            <b>{monitors.length}</b>
          </div>
          <div>
            <span className="eyebrow">Uptime · recent</span>
            <b>{formatPct(avg)}</b>
          </div>
          <div>
            <span className="eyebrow">Last change</span>
            <b>{latest ? timeAgo(latest.lastChange as string) : "–"}</b>
          </div>
        </section>
      )}

      {(monitors.length > 0 || isLoading) && (
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Show">
            <button className={view === "all" ? "on" : ""} onClick={() => set("view", "all", "all")}>
              All
            </button>
            <button className={view === "down" ? "on" : ""} onClick={() => set("view", "down", "all")}>
              Down{down.length > 0 ? ` · ${down.length}` : ""}
            </button>
            <button className={view === "up" ? "on" : ""} onClick={() => set("view", "up", "all")}>
              Up
            </button>
          </div>
          <input
            className="ctl search"
            placeholder="Filter by name or URL"
            aria-label="Filter monitors"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="ctl grow"
            aria-label="Sort by"
            value={sort}
            onChange={(e) => set("sort", e.target.value, "status")}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error ? (
        <div className="err-box" role="alert">
          Couldn't load monitors.
          <button onClick={() => void refetch()}>Retry</button>
        </div>
      ) : isLoading ? (
        <div className="table card" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: "22px 20px", borderBottom: "1px solid var(--line2)" }}>
              <div className="skel" style={{ width: `${60 - i * 10}%` }} />
            </div>
          ))}
        </div>
      ) : monitors.length === 0 ? (
        <div className="table card">
          <div className="empty">
            <h2>Know before your users do</h2>
            <p>
              Add a monitor and Hawkeye will check it on a schedule, then tell you the moment it stops responding.
            </p>
            <button className="btn pri" style={{ marginTop: 18 }} onClick={() => setCreating(true)}>
              Add your first monitor
            </button>
          </div>
        </div>
      ) : (
        <div className={`table card ${isPlaceholderData ? "stale" : ""}`}>
          <div className="thead mhead">
            <span>Monitor</span>
            <span>Last 60 checks</span>
            <span className="r">Uptime</span>
            <span>Status</span>
          </div>
          {shown.length === 0 ? (
            <div className="empty" style={{ padding: "36px 24px" }}>
              <p>No monitors match this view.</p>
            </div>
          ) : (
            shown.map((m) => <Row key={m.id} m={m} org={org} />)
          )}
        </div>
      )}

      {creating && <MonitorForm org={org} onClose={() => setCreating(false)} />}
    </div>
  );
}
