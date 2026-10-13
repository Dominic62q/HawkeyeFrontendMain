import { Link, useParams } from "react-router-dom";
import { TrendChart } from "../components/PerfCharts";
import { compact, timeAgo } from "../lib/format";
import { errorTone, fmtDuration, fmtErrorRate, fmtRate, opLabel } from "../lib/performance";
import { useProjects, useTransactionGroup, useTransactionSpans, useTransactionTrend } from "../lib/queries";

export function TransactionDetail() {
  const { org = "", id = "" } = useParams();
  const group = useTransactionGroup(org, id);
  const trend = useTransactionTrend(org, id);
  const spans = useTransactionSpans(org, id);
  const projects = useProjects(org);

  if (group.isLoading) {
    return (
      <div className="wrap" aria-busy="true">
        <div className="skel" style={{ width: "40%", height: 34 }} />
      </div>
    );
  }
  if (group.error || !group.data) {
    return (
      <div className="wrap">
        <div className="err-box" role="alert">
          Couldn't find that transaction. <Link to={`/${org}/performance`}>Back to performance</Link>
        </div>
      </div>
    );
  }

  const g = group.data;
  const tone = errorTone(g.errorRate);
  const project = projects.data?.find((p) => p.id === String(g.project))?.name;
  const spanRows = [...(spans.data ?? [])].sort((a, b) => b.totalTime - a.totalTime).slice(0, 12);
  const spanTotal = spanRows.reduce((a, s) => a + s.totalTime, 0);

  return (
    <div className="wrap">
      <div className="crumb">
        <Link to={`/${org}/performance`}>Performance</Link> / {g.transaction}
      </div>

      <div className="dh">
        <div>
          <div className="top">
            <span className="tag">{opLabel(g.op)}</span>
            {g.method && <span className="tag">{g.method}</span>}
          </div>
          <h1 className="mono-h">{g.transaction}</h1>
          <div className="where">
            {project ?? "Project"} · last seen {timeAgo(g.lastSeen)}
          </div>
        </div>
      </div>

      <div className="strip card">
        <div>
          <span className="eyebrow">Requests</span>
          <b>{compact(g.count)}</b>
        </div>
        <div>
          <span className="eyebrow">Median</span>
          <b>{fmtDuration(g.p50)}</b>
        </div>
        <div>
          <span className="eyebrow">p95</span>
          <b>{fmtDuration(g.p95)}</b>
        </div>
        <div>
          <span className="eyebrow">Error rate</span>
          <b className={tone === "bad" ? "bad" : ""}>{fmtErrorRate(g.errorRate)}</b>
        </div>
      </div>

      <div className="cols">
        <div>
          <h3 className="sec">Average duration</h3>
          <div className="card cpad" style={{ marginBottom: 24 }}>
            {trend.isLoading ? (
              <div className="skel" style={{ height: 150 }} />
            ) : (trend.data?.length ?? 0) === 0 ? (
              <p className="rc-empty">No trend data for the last 7 days yet.</p>
            ) : (
              <TrendChart points={trend.data ?? []} />
            )}
          </div>

          <h3 className="sec">Where the time goes</h3>
          <div className="card">
            {spans.isLoading ? (
              <div className="cpad">
                <div className="skel" />
              </div>
            ) : spanRows.length === 0 ? (
              <p className="cpad" style={{ color: "var(--mute)" }}>
                No span breakdown yet. Spans are summarised after they're archived, so recent traffic can take a while
                to appear.
              </p>
            ) : (
              <table className="ctable">
                <thead>
                  <tr>
                    <th>Span</th>
                    <th className="r">Count</th>
                    <th className="r">Avg</th>
                    <th className="r">p95</th>
                    <th className="share-h">Share of time</th>
                  </tr>
                </thead>
                <tbody>
                  {spanRows.map((s) => (
                    <tr key={`${s.op}:${s.description}`}>
                      <td>
                        <div className="spandesc">
                          <span className="tag">{s.op}</span>
                          <span className="mono" title={s.description}>
                            {s.description || "(no description)"}
                          </span>
                        </div>
                      </td>
                      <td className="r mono">{compact(s.count)}</td>
                      <td className="r mono">{fmtDuration(s.avgDuration)}</td>
                      <td className="r mono">{fmtDuration(s.p95Duration)}</td>
                      <td className="share">
                        <i style={{ width: `${spanTotal ? (s.totalTime / spanTotal) * 100 : 0}%` }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside>
          <div className="card panel">
            <h3 className="sec">Details</h3>
            <div className="kv"><span>Operation</span><b>{opLabel(g.op)}</b></div>
            {g.method && <div className="kv"><span>Method</span><b>{g.method}</b></div>}
            <div className="kv"><span>Average</span><b>{fmtDuration(g.avgDuration)}</b></div>
            <div className="kv"><span>Throughput</span><b>{fmtRate(g.throughput)}</b></div>
            <div className="kv"><span>Failed</span><b>{compact(g.errorCount)}</b></div>
            {project && <div className="kv"><span>Project</span><b>{project}</b></div>}
            <div className="kv"><span>First seen</span><b>{timeAgo(g.firstSeen)}</b></div>
            <div className="kv"><span>Last seen</span><b>{timeAgo(g.lastSeen)}</b></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
