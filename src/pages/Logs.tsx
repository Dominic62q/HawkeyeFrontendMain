import { Fragment, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CopyButton } from "../components/Copy";
import { LogChart } from "../components/LogChart";
import { compact, timeAgo } from "../lib/format";
import {
  LEVELS,
  RANGES,
  stamp,
  useLogResources,
  useLogStats,
  useLogs,
  type LogEvent,
  type LogFilters,
  type LogLevel,
  type RangeId,
} from "../lib/logs";
import { useProjects } from "../lib/queries";

const MAX_HITS = 1000;

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

type Narrow = (key: "service" | "environment" | "host" | "trace", value: string) => void;

function Detail({ log, project, narrow }: { log: LogEvent; project: string; narrow: Narrow }) {
  const attrs = Object.keys(log.data).length > 0;
  const field = (label: string, value: string | null, key?: "service" | "environment" | "host" | "trace") =>
    value ? (
      <>
        <dt>{label}</dt>
        <dd>
          {key ? (
            <button className="link-btn tight" title={`Only show this ${label.toLowerCase()}`} onClick={() => narrow(key, value)}>
              {value}
            </button>
          ) : (
            value
          )}
        </dd>
      </>
    ) : null;

  return (
    <div className="ldetail">
      <dl className="lkv">
        {field("Time", new Date(log.timestamp).toISOString())}
        {field("Service", log.service, "service")}
        {field("Environment", log.environment, "environment")}
        {field("Host", log.host, "host")}
        {field("Project", project)}
        {field("Trace", log.traceID, "trace")}
        {field("Span", log.spanID)}
        {field("ID", log.id)}
      </dl>
      {attrs && (
        <>
          <span className="eyebrow">Attributes</span>
          <pre className="lattrs">{JSON.stringify(log.data, null, 2)}</pre>
        </>
      )}
      <div className="keyacts">
        <CopyButton text={JSON.stringify(log, null, 2)} label="Copy as JSON" />
        {log.traceID && (
          <button className="btn sm" onClick={() => narrow("trace", log.traceID as string)}>
            Show this trace
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  log,
  open,
  query,
  project,
  onToggle,
  narrow,
}: {
  log: LogEvent;
  open: boolean;
  query: string;
  project: string;
  onToggle: () => void;
  narrow: Narrow;
}) {
  const t = stamp(log.timestamp);
  return (
    <>
      <button className={`lrow ${open ? "open" : ""}`} onClick={onToggle} aria-expanded={open}>
        <span className="ltime">{t.time}</span>
        <span className={`lvl lv-${log.level}`}>{log.level}</span>
        <span className="lsvc">{log.service || "–"}</span>
        <span className="lbody">{highlight(log.body, query)}</span>
      </button>
      {open && <Detail log={log} project={project} narrow={narrow} />}
    </>
  );
}

export function Logs() {
  const { org = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const projects = useProjects(org);

  const range = (RANGES.find((r) => r.id === params.get("range"))?.id ?? "24h") as RangeId;
  const levels = (params.get("level") ?? "")
    .split(",")
    .filter((l): l is LogLevel => (LEVELS as readonly string[]).includes(l));
  const filters: LogFilters = {
    range,
    levels,
    service: params.get("service") ?? "",
    environment: params.get("env") ?? "",
    host: params.get("host") ?? "",
    traceId: params.get("trace") ?? "",
    query: params.get("q") ?? "",
    project: params.get("project") ?? "",
  };

  const [live, setLive] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState(filters.query);

  // Work from the live URL rather than this render's copy, so quick successive changes don't undo each other.
  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(window.location.search);
    change(next);
    setParams(next, { replace: true });
    setOpen(null);
  };
  const set = (updates: Record<string, string>) =>
    update((next) => {
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
    });

  // Search as you type, but only hit the API once typing pauses. `pushed` is the last value we put in the
  // URL ourselves, so a late URL update never overwrites what is being typed.
  const pushed = useRef(filters.query);
  useEffect(() => {
    if (text.trim() === filters.query) return;
    const id = setTimeout(() => {
      pushed.current = text.trim();
      set({ q: text.trim() });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  useEffect(() => {
    if (filters.query !== pushed.current) {
      pushed.current = filters.query;
      setText(filters.query);
    }
  }, [filters.query]);

  const logsQ = useLogs(org, filters, live);
  const stats = useLogStats(org, filters);
  const services = useLogResources(org, "service");
  const envs = useLogResources(org, "environment");
  const hosts = useLogResources(org, "host");

  const logs = logsQ.data?.pages.flatMap((p) => p.logs) ?? [];
  const hits = logsQ.data?.pages[0]?.hits ?? 0;
  const projectName = (id: number) => projects.data?.find((p) => Number(p.id) === id)?.name ?? `Project ${id}`;

  const count = (names: string[]) =>
    (stats.data?.series ?? []).filter((s) => names.includes(s.name)).reduce((n, s) => n + s.data.reduce((a, b) => a + b, 0), 0);
  const total = count([...LEVELS]);

  const filtered = filters.levels.length > 0 || filters.service || filters.environment || filters.host || filters.traceId || filters.query;
  const clear = () => set({ level: "", service: "", env: "", host: "", trace: "", q: "" });

  const toggleLevel = (l: LogLevel) =>
    update((next) => {
      const current = (next.get("level") ?? "").split(",").filter(Boolean);
      const after = current.includes(l) ? current.filter((x) => x !== l) : [...current, l];
      if (after.length) next.set("level", after.join(","));
      else next.delete("level");
    });

  const narrow: Narrow = (key, value) => set({ [key === "environment" ? "env" : key]: value });

  const days = new Set<string>();
  const rangeLabel = range === "6h" ? "6 hours" : range === "24h" ? "24 hours" : "7 days";

  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <h1>Logs</h1>
          <p className="psub">
            {org} · {filters.project ? projectName(Number(filters.project)) : "All projects"}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? "on" : ""} onClick={() => set({ range: r.id === "24h" ? "" : r.id })}>
              {r.id === "6h" ? "6 hours" : r.id === "24h" ? "24 hours" : "7 days"}
            </button>
          ))}
        </div>
      </div>

      <section className="summary card" aria-label="Summary">
        <div className="stats">
          <div className="stat">
            <span className="eyebrow">Logs</span>
            <b>{stats.data ? compact(total) : "–"}</b>
            <small>in the last {rangeLabel}</small>
          </div>
          <div className="stat">
            <span className="eyebrow">Errors</span>
            <b className={count(["error", "fatal"]) > 0 ? "hot" : ""}>{stats.data ? compact(count(["error", "fatal"])) : "–"}</b>
            <small>error and fatal</small>
          </div>
          <div className="stat">
            <span className="eyebrow">Warnings</span>
            <b>{stats.data ? compact(count(["warn"])) : "–"}</b>
            <small>warn level</small>
          </div>
          <div className="stat">
            <span className="eyebrow">Last log</span>
            <b>{logs[0] && !filtered ? timeAgo(logs[0].timestamp).replace(" ago", "") : "–"}</b>
            <small>{logs[0] && !filtered ? "ago" : "unfiltered view"}</small>
          </div>
        </div>
        <div className="chart">
          <div className="chart-head">
            <span className="eyebrow">Log volume</span>
            <span className="eyebrow">per hour</span>
          </div>
          <LogChart stats={stats.data} range={range} />
          <div className="legend">
            {LEVELS.map((l) => (
              <span key={l}>
                <i className={`sw lv-${l}`} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="ctl search"
          type="search"
          placeholder="Search log messages"
          aria-label="Search log messages"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className={`btn sm live ${live ? "on" : ""}`} aria-pressed={live} onClick={() => setLive((v) => !v)}>
          <i className="livedot" />
          Live
        </button>
      </div>
      <div className="toolbar">
        <div className="lvls" role="group" aria-label="Levels">
          {LEVELS.map((l) => (
            <button key={l} className={`lvbtn ${levels.includes(l) ? "on" : ""}`} aria-pressed={levels.includes(l)} onClick={() => toggleLevel(l)}>
              <i className={`sw lv-${l}`} />
              {l}
            </button>
          ))}
        </div>
        <select className="ctl" aria-label="Service" value={filters.service} onChange={(e) => set({ service: e.target.value })}>
          <option value="">All services</option>
          {services.data?.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="ctl" aria-label="Environment" value={filters.environment} onChange={(e) => set({ env: e.target.value })}>
          <option value="">All environments</option>
          {envs.data?.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="ctl" aria-label="Host" value={filters.host} onChange={(e) => set({ host: e.target.value })}>
          <option value="">All hosts</option>
          {hosts.data?.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {filters.traceId && (
        <div className="toolbar">
          <span className="pill">
            Trace {filters.traceId.slice(0, 8)}…
            <button aria-label="Clear trace filter" onClick={() => set({ trace: "" })}>
              ✕
            </button>
          </span>
        </div>
      )}

      {logsQ.error && !logsQ.data ? (
        <div className="err-box" role="alert">
          Couldn't load logs.
          <button onClick={() => void logsQ.refetch()}>Retry</button>
        </div>
      ) : logsQ.isLoading ? (
        <div className="table card" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--line2)" }}>
              <div className="skel" style={{ width: `${88 - i * 9}%` }} />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="table card">
          <div className="empty">
            {filtered ? (
              <>
                <h2>No logs match</h2>
                <p>Nothing in the last {rangeLabel} fits these filters.</p>
                <button className="btn" style={{ marginTop: 18 }} onClick={clear}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h2>No logs in the last {rangeLabel}</h2>
                <p>
                  Send logs from an OpenTelemetry exporter to <code>/v1/logs</code>, using your project's key, and they will show up here
                  within seconds.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={`table card ${logsQ.isPlaceholderData ? "stale" : ""}`}>
          <div className="loghead">
            <span>
              {hits >= MAX_HITS ? `${MAX_HITS.toLocaleString()}+` : hits.toLocaleString()} {hits === 1 ? "log" : "logs"}
              {logs.length < hits ? ` · showing ${logs.length}` : ""}
            </span>
            <span>Newest first</span>
          </div>
          {logs.map((log) => {
            const day = stamp(log.timestamp).date;
            const first = !days.has(day);
            days.add(day);
            return (
              <Fragment key={log.id}>
                {first && <div className="lday">{day}</div>}
                <Row
                  log={log}
                  open={open === log.id}
                  query={filters.query}
                  project={projectName(log.projectId)}
                  onToggle={() => setOpen(open === log.id ? null : log.id)}
                  narrow={narrow}
                />
              </Fragment>
            );
          })}
          <div className="lmore">
            {logsQ.hasNextPage ? (
              <button className="btn" disabled={logsQ.isFetchingNextPage} onClick={() => void logsQ.fetchNextPage()}>
                {logsQ.isFetchingNextPage ? "Loading…" : "Load older logs"}
              </button>
            ) : (
              <span className="hint">That's everything in this range.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
