import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Pulse, Sparkline, eventPoints } from "../components/Charts";
import { ConnectApp } from "../components/ConnectApp";
import { compact, timeAgo, toMs } from "../lib/format";
import {
  useBulkUpdateIssues,
  useEnvironments,
  useIssues,
  useOrgProjects,
  useProjects,
  type IssueFilters,
  type IssueSort,
} from "../lib/queries";
import type { Issue, IssueStatus } from "../lib/types";

const STATUSES: { id: IssueStatus | "all"; label: string }[] = [
  { id: "unresolved", label: "Unresolved" },
  { id: "ignored", label: "Ignored" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

const SORTS: { id: IssueSort; label: string }[] = [
  { id: "-last_seen", label: "Last seen" },
  { id: "-first_seen", label: "First seen" },
  { id: "-count", label: "Most events" },
  { id: "-priority", label: "Priority" },
];

const HOUR = 3_600_000;

function titleParts(issue: Issue): [string, string] {
  const { type, value } = issue.metadata;
  if (type) return [type, value ?? ""];
  return [issue.title, ""];
}

function culpritOf(issue: Issue): string {
  if (issue.culprit) return issue.culprit;
  const { filename, function: fn } = issue.metadata;
  return [filename, fn && `in ${fn}`].filter(Boolean).join(" ");
}

function IssueRow({
  issue,
  org,
  period,
  selected,
  onToggle,
}: {
  issue: Issue;
  org: string;
  period: "24h" | "14d";
  selected: boolean;
  onToggle: () => void;
}) {
  const [type, value] = titleParts(issue);
  const sev = issue.status === "resolved" ? "done" : issue.level === "warning" ? "wrn" : "err";
  const isNew = Date.now() - new Date(issue.firstSeen).getTime() < HOUR;
  return (
    <div className={`row ${selected ? "sel" : ""}`}>
      <input
        className="check"
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${type}`}
      />
      <div style={{ minWidth: 0 }}>
        <Link className="rowlink" to={`/${org}/issues/${issue.id}`}>
          <div className="ititle">
            <strong>{type}</strong>
            {value && <span className="msg">{value}</span>}
          </div>
        </Link>
        <div className="imeta">
          <span className={`dot ${sev}`} title={issue.level} />
          <span className="sid">{issue.shortId}</span>
          <span className="culprit">{culpritOf(issue) || issue.project.name}</span>
          {isNew && <span className="tag new">New</span>}
          {issue.status !== "unresolved" && (
            <span className={`tag ${issue.status === "resolved" ? "ok" : ""}`}>
              {issue.status === "resolved" ? "Resolved" : "Ignored"}
            </span>
          )}
        </div>
      </div>
      <div className="trend">
        <Sparkline issue={issue} period={period} />
      </div>
      <div className="num">{compact(issue.count)}</div>
      <div className="age">{timeAgo(issue.lastSeen)}</div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading issues">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ padding: "22px 20px", borderBottom: "1px solid var(--line2)" }}>
          <div className="skel" style={{ width: `${68 - i * 9}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Issues() {
  const { org = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const environments = useEnvironments(org);
  const projects = useProjects(org);
  const orgProjects = useOrgProjects(org);
  const bulk = useBulkUpdateIssues(org);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filters: IssueFilters = {
    status: (params.get("status") as IssueFilters["status"]) ?? "unresolved",
    environment: params.get("env") ?? "",
    project: params.get("project") ?? "",
    period: params.get("period") === "14d" ? "14d" : "24h",
    sort: (SORTS.find((s) => s.id === params.get("sort"))?.id ?? "-last_seen") as IssueSort,
  };
  const q = params.get("q") ?? "";

  const set = (key: string, value: string, fallback = "") => {
    const next = new URLSearchParams(params);
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const { data, error, isLoading, isPlaceholderData, refetch } = useIssues(org, filters, q);
  const issues = data?.issues ?? [];
  const chosen = issues.filter((i) => selected.has(i.id));
  const allChosen = issues.length > 0 && chosen.length === issues.length;

  const now = Date.now();
  const windowStart = now - (filters.period === "24h" ? 1 : 14) * 24 * HOUR;
  const eventsInPeriod = issues.reduce(
    (sum, i) =>
      sum +
      eventPoints(i, filters.period)
        .filter(([ts]) => toMs(ts) >= windowStart)
        .reduce((s, p) => s + p[1], 0),
    0,
  );
  const newToday = issues.filter((i) => now - new Date(i.firstSeen).getTime() < 24 * HOUR).length;
  const lastEvent = issues.reduce<string | null>(
    (best, i) => (!best || i.lastSeen > best ? i.lastSeen : best),
    null,
  );
  const projectName = projects.data?.find((p) => p.id === filters.project)?.name ?? "All projects";
  // A project that has never received an event gets setup help instead of "All quiet".
  const inView = (orgProjects.data ?? []).filter((p) => !filters.project || p.id === filters.project);
  const waiting = inView.length > 0 && inView.every((p) => !p.firstEvent) && !q && !filters.environment ? inView[0] : null;
  const statusLabel = STATUSES.find((s) => s.id === filters.status)?.label.toLowerCase() ?? "";

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const apply = (status: IssueStatus) =>
    bulk.mutate({ ids: chosen.map((i) => i.id), status }, { onSuccess: () => setSelected(new Set()) });

  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <h1>Issues</h1>
          <p className="psub">
            {org} · {projectName}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          {(["24h", "14d"] as const).map((p) => (
            <button
              key={p}
              className={filters.period === p ? "on" : ""}
              onClick={() => set("period", p, "24h")}
            >
              {p === "24h" ? "Last 24 hours" : "Last 14 days"}
            </button>
          ))}
        </div>
      </div>

      <section className="summary card" aria-label="Summary">
        <div className="stats">
          <div className="stat">
            <span className="eyebrow">{filters.status === "all" ? "Issues" : statusLabel}</span>
            <b>{data ? data.total : "–"}</b>
            <small>in this view</small>
          </div>
          <div className="stat">
            <span className="eyebrow">New · 24h</span>
            <b className={newToday > 0 ? "hot" : ""}>{data ? newToday : "–"}</b>
            <small>first seen today</small>
          </div>
          <div className="stat">
            <span className="eyebrow">Events</span>
            <b>{data ? compact(eventsInPeriod) : "–"}</b>
            <small>in the last {filters.period === "24h" ? "24 hours" : "14 days"}</small>
          </div>
          <div className="stat">
            <span className="eyebrow">Last event</span>
            <b>{lastEvent ? timeAgo(lastEvent).replace(" ago", "") : "–"}</b>
            <small>{lastEvent ? "ago" : "nothing yet"}</small>
          </div>
        </div>
        <div className="chart">
          <div className="chart-head">
            <span className="eyebrow">Event volume</span>
            <span className="eyebrow">per {filters.period === "24h" ? "hour" : "day"}</span>
          </div>
          <Pulse issues={issues} period={filters.period} />
        </div>
      </section>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              className={filters.status === s.id ? "on" : ""}
              onClick={() => set("status", s.id, "unresolved")}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          className="ctl"
          aria-label="Environment"
          value={filters.environment}
          onChange={(e) => set("env", e.target.value)}
        >
          <option value="">All environments</option>
          {environments.data?.map((e) => (
            <option key={e.id} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
        {q && (
          <button className="pill" onClick={() => set("q", "")} aria-label="Clear search">
            “{q}” ✕
          </button>
        )}
        <select
          className="ctl grow"
          aria-label="Sort by"
          value={filters.sort}
          onChange={(e) => set("sort", e.target.value, "-last_seen")}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="err-box" role="alert">
          Couldn't load issues.
          <button onClick={() => void refetch()}>Retry</button>
        </div>
      ) : (
        <div className={`table card ${isPlaceholderData ? "stale" : ""}`} aria-busy={isPlaceholderData}>
          {chosen.length > 0 ? (
            <div className="thead bulk" role="toolbar" aria-label="Bulk actions">
              <input
                className="check"
                type="checkbox"
                checked={allChosen}
                onChange={() => setSelected(allChosen ? new Set() : new Set(issues.map((i) => i.id)))}
                aria-label="Select all issues"
              />
              <b>{chosen.length} selected</b>
              {filters.status !== "resolved" && (
                <button disabled={bulk.isPending} onClick={() => apply("resolved")}>
                  Resolve
                </button>
              )}
              {filters.status !== "ignored" && (
                <button disabled={bulk.isPending} onClick={() => apply("ignored")}>
                  Ignore
                </button>
              )}
              {(filters.status === "resolved" || filters.status === "ignored" || filters.status === "all") && (
                <button disabled={bulk.isPending} onClick={() => apply("unresolved")}>
                  Reopen
                </button>
              )}
              <button onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          ) : (
            <div className="thead">
              <input
                className="check"
                type="checkbox"
                checked={false}
                disabled={issues.length === 0}
                onChange={() => setSelected(new Set(issues.map((i) => i.id)))}
                aria-label="Select all issues"
              />
              <span>Issue</span>
              <span>Trend</span>
              <span className="r">Events</span>
              <span className="r">Last seen</span>
            </div>
          )}
          {bulk.isError && (
            <div className="err-box" role="alert" style={{ margin: 12 }}>
              Couldn't update those issues. Try again.
            </div>
          )}
          {isLoading ? (
            <ListSkeleton />
          ) : issues.length === 0 && waiting ? (
            <div className="cpad">
              <ConnectApp org={org} slug={waiting.slug} platform={waiting.platform} title="Waiting for your first event" />
            </div>
          ) : issues.length === 0 ? (
            <div className="empty">
              <h2>All quiet</h2>
              <p>No {filters.status === "all" ? "" : statusLabel + " "}issues match this view.</p>
            </div>
          ) : (
            issues.map((i) => (
              <IssueRow
                key={i.id}
                issue={i}
                org={org}
                period={filters.period}
                selected={selected.has(i.id)}
                onToggle={() => toggle(i.id)}
              />
            ))
          )}
        </div>
      )}

      {data && issues.length > 0 && (
        <div className="tfoot">
          <span>
            Showing {issues.length} of {data.total} {data.total === 1 ? "issue" : "issues"}
          </span>
          {data.total > issues.length && <span>Narrow the view with filters or search to see the rest.</span>}
        </div>
      )}
    </div>
  );
}
