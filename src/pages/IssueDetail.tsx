import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { timeAgo } from "../lib/format";
import { useIssue, useLatestEvent, useUpdateIssueStatus } from "../lib/queries";
import type { Breadcrumb, EventEntry, ExceptionValue, IssueEvent, StackFrame } from "../lib/types";

function Frame({ frame, culprit }: { frame: StackFrame; culprit: boolean }) {
  const file = frame.filename ?? frame.absPath ?? frame.module ?? "unknown";
  const loc = frame.lineNo ? `${file}:${frame.lineNo}` : file;
  return (
    <>
      <div className={`frame ${culprit ? "cul" : frame.inApp === false ? "sys" : ""}`}>
        <span className="fn">{frame.function ?? "<anonymous>"}()</span>
        {culprit && <span className="badge">culprit</span>}
        <span className="loc">{loc}</span>
      </div>
      {culprit && (frame.context?.length || frame.context_line) && (
        <div className="src">
          {(frame.context?.length ? frame.context : [[frame.lineNo ?? 0, frame.context_line ?? ""]]).map(
            ([n, line]) => (
              <div key={n} className={n === frame.lineNo ? "bad" : ""}>
                <i>{n}</i>
                {line}
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}

function Trace({ value }: { value: ExceptionValue }) {
  // Sentry-style payloads list frames oldest-first, so the culprit is the last one.
  const frames = [...(value.stacktrace?.frames ?? [])].reverse();
  const [showAll, setShowAll] = useState(false);
  if (frames.length === 0) return <p style={{ color: "var(--mute)" }}>No stack trace was sent with this event.</p>;
  const appFrames = frames.filter((f) => f.inApp !== false);
  const shown = showAll || appFrames.length === 0 ? frames : appFrames;
  return (
    <>
      <div className="trace">
        {shown.map((f, i) => (
          <Frame key={i} frame={f} culprit={f === frames[0]} />
        ))}
      </div>
      {appFrames.length > 0 && appFrames.length < frames.length && (
        <button className="link-btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Hide library frames" : `Show ${frames.length - appFrames.length} library frames`}
        </button>
      )}
    </>
  );
}

function entries<T extends EventEntry["type"]>(event: IssueEvent, type: T) {
  return event.entries.filter((e) => e.type === type);
}

function Breadcrumbs({ crumbs, failedAt }: { crumbs: Breadcrumb[]; failedAt: string }) {
  return (
    <div className="panel">
      <div className="tl">
        {crumbs.slice(-12).map((c, i) => (
          <div key={i}>
            {c.timestamp && <small>{new Date(c.timestamp).toLocaleTimeString()}</small>}
            {[c.category, c.message].filter(Boolean).join(" · ") || c.type || "event"}
          </div>
        ))}
        <div className="x">
          <small>failure</small>
          {failedAt}
        </div>
      </div>
    </div>
  );
}

export function IssueDetail() {
  const { org = "", id = "" } = useParams();
  const issue = useIssue(org, id);
  const event = useLatestEvent(id);
  const update = useUpdateIssueStatus(org, id);

  if (issue.isLoading) {
    return (
      <div className="wrap" aria-busy="true">
        <div className="skel" style={{ width: "50%", height: 46 }} />
      </div>
    );
  }
  if (issue.error || !issue.data) {
    return (
      <div className="wrap">
        <div className="err-box" role="alert">
          Couldn't find that issue. <Link to={`/${org}/issues`}>Back to issues</Link>
        </div>
      </div>
    );
  }

  const it = issue.data;
  const exceptions = event.data
    ? (entries(event.data, "exception") as { data: { values: ExceptionValue[] } }[]).flatMap((e) => e.data.values)
    : [];
  const crumbs = event.data
    ? (entries(event.data, "breadcrumbs") as { data: { values: Breadcrumb[] } }[]).flatMap((e) => e.data.values)
    : [];
  const tag = (key: string) => event.data?.tags.find((t) => t.key === key)?.value;
  const resolved = it.status === "resolved";

  return (
    <div className="wrap">
      <div className="crumb">
        <Link to={`/${org}/issues`}>Issues</Link> / {it.shortId}
      </div>
      <div className="dh">
        <div>
          <h1>{it.metadata.type ?? it.title}</h1>
          <p>{it.metadata.value ?? ""}</p>
        </div>
        <div className="acts">
          <button
            className="btn"
            disabled={update.isPending}
            onClick={() => update.mutate(it.status === "ignored" ? "unresolved" : "ignored")}
          >
            {it.status === "ignored" ? "Unignore" : "Ignore"}
          </button>
          <button
            className="btn pri"
            disabled={update.isPending}
            onClick={() => update.mutate(resolved ? "unresolved" : "resolved")}
          >
            {resolved ? "Reopen" : "Resolve"}
          </button>
        </div>
      </div>
      {update.isError && (
        <div className="err-box" role="alert">
          Couldn't update this issue. Try again.
        </div>
      )}

      <div className="cols">
        <div>
          <h3 className="sec">Where it broke</h3>
          {event.isLoading ? (
            <div className="skel" style={{ height: 120 }} />
          ) : exceptions.length === 0 ? (
            <p style={{ color: "var(--mute)" }}>{event.data?.message ?? "No exception details for this event."}</p>
          ) : (
            exceptions.map((ex, i) => <Trace key={i} value={ex} />)
          )}

          {crumbs.length > 0 && (
            <>
              <h3 className="sec" style={{ marginTop: 34 }}>
                What led up to it
              </h3>
              <Breadcrumbs crumbs={crumbs} failedAt={`${it.metadata.type ?? "Error"} raised`} />
            </>
          )}
        </div>
        <aside>
          <div className="panel">
            <h3 className="sec">At a glance</h3>
            <div className="kv"><span>Events</span><b>{it.count}</b></div>
            <div className="kv"><span>Users hit</span><b>{it.userCount}</b></div>
            <div className="kv"><span>First seen</span><b>{timeAgo(it.firstSeen)}</b></div>
            <div className="kv"><span>Last seen</span><b>{timeAgo(it.lastSeen)}</b></div>
            <div className="kv"><span>Status</span><b className={`st-${it.status}`}>{it.status[0].toUpperCase() + it.status.slice(1)}</b></div>
          </div>
          <div className="panel">
            <h3 className="sec">Context</h3>
            <div className="kv"><span>Project</span><b>{it.project.name}</b></div>
            {tag("environment") && <div className="kv"><span>Environment</span><b>{tag("environment")}</b></div>}
            {(tag("release") ?? it.lastRelease?.version) && (
              <div className="kv"><span>Release</span><b className="mono" style={{ fontSize: 13 }}>{tag("release") ?? it.lastRelease?.version}</b></div>
            )}
            {event.data?.platform && <div className="kv"><span>Platform</span><b>{event.data.platform}</b></div>}
            {it.logger && <div className="kv"><span>Logger</span><b className="mono" style={{ fontSize: 13 }}>{it.logger}</b></div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
