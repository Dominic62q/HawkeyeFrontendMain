import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LatencyRange } from "../components/PerfCharts";
import { compact, timeAgo } from "../lib/format";
import { errorTone, fmtDuration, fmtErrorRate, fmtRate, opLabel, totals } from "../lib/performance";
import { useProjects, useTransactionGroups, type TransactionSort } from "../lib/queries";
import type { TransactionGroup } from "../lib/types";

const SORTS: { id: TransactionSort; label: string }[] = [
  { id: "-avg_duration", label: "Slowest" },
  { id: "-count", label: "Most requests" },
  { id: "-created", label: "Newest" },
];

function Row({ g, org, max }: { g: TransactionGroup; org: string; max: number }) {
  return (
    <div className="row prow">
      <div style={{ minWidth: 0 }}>
        <Link className="rowlink" to={`/${org}/performance/${g.id}`}>
          <div className="ititle">
            <strong className="tname">{g.transaction}</strong>
          </div>
        </Link>
        <div className="imeta">
          <span className="tag">{opLabel(g.op)}</span>
          <span>{compact(g.count)} requests</span>
          <span>· {timeAgo(g.lastSeen)}</span>
        </div>
      </div>
      <LatencyRange p50={g.p50} p95={g.p95} max={max} />
      <div className="num p50">{fmtDuration(g.p50)}</div>
      <div className="num p95">{fmtDuration(g.p95)}</div>
      <div className="num soft">{fmtRate(g.throughput)}</div>
      <div className={`num err ${errorTone(g.errorRate)}`}>{fmtErrorRate(g.errorRate)}</div>
    </div>
  );
}

export function Performance() {
  const { org = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const project = params.get("project") ?? "";
  const sort = (SORTS.find((s) => s.id === params.get("sort"))?.id ?? "-avg_duration") as TransactionSort;
  const [filter, setFilter] = useState("");
  const projects = useProjects(org);
  const { data, error, isLoading, isPlaceholderData, refetch } = useTransactionGroups(org, sort, project, filter.trim());

  const groups = data ?? [];
  const sum = totals(groups);
  const max = Math.max(0, ...groups.map((g) => g.p95 ?? 0));
  const projectName = projects.data?.find((p) => p.id === project)?.name ?? "All projects";

  const setSort = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "-avg_duration") next.delete("sort");
    else next.set("sort", value);
    setParams(next);
  };

  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <h1>Performance</h1>
          <p className="psub">
            {org} · {projectName}
          </p>
        </div>
      </div>

      {groups.length > 0 && (
        <section className="strip card" aria-label="Summary">
          <div>
            <span className="eyebrow">Transactions</span>
            <b>{groups.length}</b>
          </div>
          <div>
            <span className="eyebrow">Requests</span>
            <b>{compact(sum.requests)}</b>
          </div>
          <div>
            <span className="eyebrow">Slowest p95</span>
            <b>{fmtDuration(sum.slowest?.p95)}</b>
          </div>
          <div>
            <span className="eyebrow">Error rate</span>
            <b className={sum.errorRate >= 5 ? "bad" : ""}>{fmtErrorRate(sum.errorRate)}</b>
          </div>
        </section>
      )}

      {(groups.length > 0 || filter || isLoading) && (
        <div className="toolbar">
          <input
            className="ctl search"
            placeholder="Filter transactions"
            aria-label="Filter transactions"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select className="ctl grow" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
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
          Couldn't load transactions.
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
      ) : groups.length === 0 ? (
        <div className="table card">
          <div className="empty">
            <h2>{filter ? "Nothing matches" : "No transactions yet"}</h2>
            <p>
              {filter
                ? "Try a shorter filter, or clear it to see everything."
                : "Turn on tracing in your SDK (set a traces sample rate) and slow requests will show up here, ranked."}
            </p>
          </div>
        </div>
      ) : (
        <div className={`table card ${isPlaceholderData ? "stale" : ""}`}>
          <div className="thead phd">
            <span>Transaction</span>
            <span>Median → p95</span>
            <span className="r">p50</span>
            <span className="r">p95</span>
            <span className="r">Rate</span>
            <span className="r">Errors</span>
          </div>
          {groups.map((g) => (
            <Row key={g.id} g={g} org={org} max={max} />
          ))}
        </div>
      )}
    </div>
  );
}
