import type { Issue } from "../lib/types";
import { toMs } from "../lib/format";

type Period = "24h" | "14d";

/**
 * Hourly stats can lag behind ingestion, so when the API has none yet we fall
 * back to a single point: the issue's total count at its last-seen time.
 */
export function eventPoints(issue: Issue, period: Period): [number, number][] {
  const stats = issue.stats[period] ?? [];
  if (stats.length > 0) return stats;
  return [[new Date(issue.lastSeen).getTime(), Number(issue.count)]];
}

function buckets(issues: Issue[], period: Period): number[] {
  const n = period === "24h" ? 24 : 14;
  const size = period === "24h" ? 3_600_000 : 86_400_000;
  const end = Date.now();
  const start = end - n * size;
  const out = new Array<number>(n).fill(0);
  for (const issue of issues) {
    for (const [ts, count] of eventPoints(issue, period)) {
      const i = Math.floor((toMs(ts) - start) / size);
      if (i >= 0 && i < n) out[i] += count;
    }
  }
  return out;
}

export function Pulse({ issues, period }: { issues: Issue[]; period: Period }) {
  const data = buckets(issues, period);
  const max = Math.max(...data, 1);
  const empty = data.every((v) => v === 0);
  const w = 600 / data.length;
  return (
    <>
      <svg
        className="pulse"
        viewBox="0 0 600 150"
        preserveAspectRatio="none"
        role="img"
        aria-label={empty ? "No events in this period" : `Events per ${period === "24h" ? "hour" : "day"}`}
      >
        {data.map((v, i) => {
          const h = empty || v === 0 ? 4 : Math.max(8, (v / max) * 146);
          const hot = v > 0 && i >= data.length - 3;
          return (
            <rect
              key={i}
              className={v === 0 ? "flat" : hot ? "hot" : "on"}
              x={i * w + 1}
              y={150 - h}
              width={w - 3}
              height={h}
              rx="2"
            />
          );
        })}
      </svg>
      <div className="axis">
        <span>{period === "24h" ? "24h ago" : "14d ago"}</span>
        <span>{period === "24h" ? "12h" : "7d"}</span>
        <span>now</span>
      </div>
    </>
  );
}

/** Per-issue trend as tiny bars, bucketed exactly like the main volume chart. */
export function Sparkline({ issue, period }: { issue: Issue; period: Period }) {
  const data = buckets([issue], period);
  const max = Math.max(...data, 1);
  const w = 120 / data.length;
  return (
    <svg className="spark" viewBox="0 0 120 32" aria-hidden="true">
      {data.map((v, i) => {
        const h = v === 0 ? 2 : Math.max(4, (v / max) * 30);
        return <rect key={i} className={v === 0 ? "flat" : "on"} x={i * w + 0.5} y={32 - h} width={Math.max(w - 1.5, 1)} height={h} rx="1" />;
      })}
    </svg>
  );
}
