import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { timeAgo } from "../lib/format";
import { useEvent, useIssue, useUpdateIssueStatus } from "../lib/queries";
import type { Breadcrumb, EventEntry, ExceptionValue, IssueEvent, StackFrame } from "../lib/types";

function Frame({ frame, culprit }: { frame: StackFrame; culprit: boolean }) {
  const file = frame.filename ?? frame.absPath ?? frame.module ?? "unknown";
  const loc = frame.lineNo ? `${file}:${frame.lineNo}` : file;
  return (
    <>
      <div className={`frame ${culprit ? "cul" : frame.inApp === false ? "sys" : ""}`}>
        <span className="fn">{frame.function ?? "<anonymous>"}()</span>
        {culprit && <span className="tag new">culprit</span>}
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

function Exception({ value }: { value: ExceptionValue }) {
  // Sentry-style payloads list frames oldest-first, so the culprit is the last one.
  const frames = [...(value.stacktrace?.frames ?? [])].reverse();
  const [showAll, setShowAll] = useState(false);
  const appFrames = frames.filter((f) => f.inApp !== false);
  // The culprit is the innermost frame of the app's own code, not a library frame below it.
  const culprit = appFrames[0] ?? frames[0];
  const shown = showAll || appFrames.length === 0 ? frames : appFrames;
  return (
    <div className="exc">
      <div className="t">{value.type ?? "Error"}</div>
      {value.value && <div className="v">{value.value}</div>}
      {frames.length === 0 ? (
        <p style={{ color: "var(--mute)", margin: "14px 0 16px" }}>No stack trace was sent with this event.</p>
      ) : (
        <div className="trace">
          {shown.map((f, i) => (
            <Frame key={i} frame={f} culprit={f === culprit} />
          ))}
        </div>
      )}
      {appFrames.length > 0 && appFrames.length < frames.length && (
        <button className="link-btn" style={{ margin: "0 0 16px" }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Hide library frames" : `Show ${frames.length - appFrames.length} library frames`}
        </button>
      )}
    </div>
  );
}

function entries<T extends EventEntry["type"]>(event: IssueEvent, type: T) {
  return event.entries.filter((e) => e.type === type);
}

function Breadcrumbs({ crumbs, failedAt }: { crumbs: Breadcrumb[]; failedAt: string }) {
  return (
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
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function IssueDetail() {
  const { org = "", id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const eventParam = params.get("event") ?? undefined;
  const issue = useIssue(org, id);
  const event = useEvent(id, eventParam);
  const update = useUpdateIssueStatus(org, id);

  if (issue.isLoading) {
    return (
      <div className="wrap" aria-busy="true">
        <div className="skel" style={{ width: "40%", height: 34 }} />
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
  const ev = event.data;
  const exceptions = ev
    ? (entries(ev, "exception") as { data: { values: ExceptionValue[] } }[]).flatMap((e) => e.data.values)
    : [];
  const crumbs = ev
    ? (entries(ev, "breadcrumbs") as { data: { values: Breadcrumb[] } }[]).flatMap((e) => e.data.values)
    : [];
  const tag = (key: string) => ev?.tags.find((t) => t.key === key)?.value;
  const resolved = it.status === "resolved";
  const release = tag("release") ?? it.lastRelease?.version;
  const sev = resolved ? "done" : it.level === "warning" ? "wrn" : "err";
  const goTo = (eventId: string | null | undefined) => {
    const next = new URLSearchParams(params);
    if (eventId) next.set("event", eventId);
    else next.delete("event");
    setParams(next);
  };
  const user = ev?.user;
  const userLabel = user?.email ?? user?.username ?? user?.id ?? user?.ip_address;
  const otherTags = ev?.tags.filter((t) => !["release", "environment"].includes(t.key)) ?? [];

  return (
    <div className="wrap">
      <div className="crumb">
        <Link to={`/${org}/issues`}>Issues</Link> / {it.shortId}
      </div>

      <div className="dh">
        <div>
          <div className="top">
            <span className={`dot ${sev}`} />
            <span>{cap(it.level)}</span>
            <span className="sid">{it.shortId}</span>
            <span className={`tag ${resolved ? "ok" : it.status === "unresolved" ? "new" : ""}`}>{cap(it.status)}</span>
          </div>
          <h1>{it.metadata.type ?? it.title}</h1>
          {it.metadata.value && <p>{it.metadata.value}</p>}
          {it.culprit && <div className="where">{it.culprit}</div>}
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

      <div className="strip card">
        <div>
          <span className="eyebrow">Events</span>
          <b>{it.count}</b>
        </div>
        <div>
          <span className="eyebrow">First seen</span>
          <b>{timeAgo(it.firstSeen)}</b>
        </div>
        <div>
          <span className="eyebrow">Last seen</span>
          <b>{timeAgo(it.lastSeen)}</b>
        </div>
        <div>
          <span className="eyebrow">Latest release</span>
          <b className="mono" style={{ fontSize: 15 }}>{release ?? "—"}</b>
        </div>
      </div>

      <div className="cols">
        <div>
          <h3 className="sec">Event</h3>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="evhead">
              <div>
                <span className="id">{ev ? ev.eventID.slice(0, 8) : "…"}</span>
                {ev && <span className="when">{timeAgo(ev.dateCreated)}</span>}
              </div>
              <div className="evnav">
                <button disabled={!ev?.previousEventID} onClick={() => goTo(ev?.previousEventID)}>
                  ← Older
                </button>
                <button disabled={!ev?.nextEventID} onClick={() => goTo(ev?.nextEventID)}>
                  Newer →
                </button>
                {eventParam && <button onClick={() => goTo(null)}>Latest</button>}
              </div>
            </div>
            {event.isLoading ? (
              <div style={{ padding: 16 }}>
                <div className="skel" style={{ height: 96 }} />
              </div>
            ) : exceptions.length === 0 ? (
              <p style={{ color: "var(--mute)", padding: 16 }}>
                {ev?.message ?? "No exception details for this event."}
              </p>
            ) : (
              exceptions.map((ex, i) => <Exception key={i} value={ex} />)
            )}
          </div>

          {crumbs.length > 0 && (
            <>
              <h3 className="sec">Breadcrumbs</h3>
              <div className="card">
                <Breadcrumbs crumbs={crumbs} failedAt={`${it.metadata.type ?? "Error"} raised`} />
              </div>
            </>
          )}
        </div>

        <aside>
          <div className="card panel">
            <h3 className="sec">Details</h3>
            <div className="kv"><span>Project</span><b>{it.project.name}</b></div>
            {tag("environment") && <div className="kv"><span>Environment</span><b>{tag("environment")}</b></div>}
            {release && <div className="kv"><span>Release</span><b className="mono">{release}</b></div>}
            {ev?.platform && <div className="kv"><span>Platform</span><b>{ev.platform}</b></div>}
            {it.logger && <div className="kv"><span>Logger</span><b className="mono">{it.logger}</b></div>}
          </div>

          {userLabel && (
            <div className="card panel">
              <h3 className="sec">User</h3>
              {user?.email && <div className="kv"><span>Email</span><b>{user.email}</b></div>}
              {user?.id && <div className="kv"><span>ID</span><b className="mono">{user.id}</b></div>}
              {user?.username && <div className="kv"><span>Username</span><b>{user.username}</b></div>}
              {user?.ip_address && <div className="kv"><span>IP</span><b className="mono">{user.ip_address}</b></div>}
            </div>
          )}

          {otherTags.length > 0 && (
            <div className="card panel">
              <h3 className="sec">Tags</h3>
              {otherTags.map((t) => (
                <div className="kv" key={t.key}>
                  <span>{t.key}</span>
                  <b className="mono">{t.value}</b>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
