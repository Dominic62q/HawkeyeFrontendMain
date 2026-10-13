import { Link, useParams, useSearchParams } from "react-router-dom";
import { Pulse, Sparkline, eventPoints } from "../components/Charts";
import { compact, timeAgo, toMs } from "../lib/format";
import { useEnvironments, useIssues, type IssueFilters } from "../lib/queries";
import type { Issue, IssueStatus } from "../lib/types";

const STATUSES: { id: IssueStatus | "all"; label: string }[] = [
  { id: "unresolved", label: "Unresolved" },
  { id: "ignored", label: "Ignored" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

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

function IssueRow({ issue, org, period }: { issue: Issue; org: string; period: "24h" | "14d" }) {
  const [type, value] = titleParts(issue);
  const sev =
    issue.status === "resolved" ? "done" : issue.level === "warning" ? "wrn" : "err";
  const isNew = Date.now() - new Date(issue.firstSeen).getTime() < 3_600_000;
  return (
    <Link className="issue" to={`/${org}/issues/${issue.id}`}>
      <div className={`sev ${sev}`} />
      <div>
        <div className="ititle">
          {isNew && <span className="badge">new</span>}
          {type} {value && <span>{value}</span>}
        </div>
        <div className="culprit">{culpritOf(issue) || issue.project.name}</div>
      </div>
      <Sparkline points={issue.stats[period] ?? []} />
      <div className="num">
        {compact(issue.count)}
        <small>events</small>
      </div>
      <div className="num hide">
        {compact(issue.userCount)}
        <small>users</small>
      </div>
      <div className="age">{timeAgo(issue.lastSeen)}</div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading issues">
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ padding: "26px 0", borderBottom: "1px solid var(--line2)" }}>
          <div className="skel" style={{ width: `${70 - i * 12}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Issues() {
  const { org = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const environments = useEnvironments(org);

  const filters: IssueFilters = {
    status: (params.get("status") as IssueFilters["status"]) ?? "unresolved",
    environment: params.get("env") ?? "",
    project: params.get("project") ?? "",
    period: params.get("period") === "14d" ? "14d" : "24h",
  };
  const q = params.get("q") ?? "";

  const set = (key: string, value: string, fallback = "") => {
    const next = new URLSearchParams(params);
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const { data, error, isLoading, refetch } = useIssues(org, filters, q);
  const issues = data?.issues ?? [];
  const windowStart = Date.now() - (filters.period === "24h" ? 1 : 14) * 86_400_000;
  const eventsInPeriod = issues.reduce(
    (sum, i) =>
      sum +
      eventPoints(i, filters.period)
        .filter(([ts]) => toMs(ts) >= windowStart)
        .reduce((s, p) => s + p[1], 0),
    0,
  );
  const fresh = issues.filter((i) => Date.now() - new Date(i.firstSeen).getTime() < 3_600_000).length;
  const label = STATUSES.find((s) => s.id === filters.status)?.label.toLowerCase() ?? "";

  return (
    <div className="wrap">
      <div className="hero">
        <div>
          <div className="eyebrow">{filters.status === "all" ? "Issues in this view" : `${label} right now`}</div>
          <div className="big">
            {data ? data.total : "–"}
            <small>{data?.total === 1 ? "issue" : "issues"}</small>
          </div>
          <div style={{ color: "var(--mute)" }}>
            {fresh} new in the last hour · {compact(eventsInPeriod)} events in {filters.period}
          </div>
        </div>
        <div>
          <Pulse issues={issues} period={filters.period} />
        </div>
      </div>

      <div className="row-ctl">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            className={`chip ${filters.status === s.id ? "on" : ""}`}
            onClick={() => set("status", s.id, "unresolved")}
          >
            {s.label}
          </button>
        ))}
        <select
          className="chip"
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
          <button className="chip on" onClick={() => set("q", "")} aria-label="Clear search">
            “{q}” ✕
          </button>
        )}
        <div className="seg" role="group" aria-label="Time range">
          {(["24h", "14d"] as const).map((p) => (
            <button
              key={p}
              className={filters.period === p ? "on" : ""}
              onClick={() => set("period", p, "24h")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="err-box" role="alert">
          Couldn't load issues.
          <button onClick={() => void refetch()}>Retry</button>
        </div>
      ) : isLoading ? (
        <ListSkeleton />
      ) : issues.length === 0 ? (
        <div className="empty">
          <h2>All quiet</h2>
          <p>
            No {filters.status === "all" ? "" : label + " "}issues match this view. Point an SDK at
            your project’s DSN and errors will show up here.
          </p>
        </div>
      ) : (
        <div>
          {issues.map((i) => (
            <IssueRow key={i.id} issue={i} org={org} period={filters.period} />
          ))}
        </div>
      )}
    </div>
  );
}
