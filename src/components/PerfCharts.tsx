import type { TransactionTrendPoint } from "../lib/types";
import { fmtDuration } from "../lib/performance";

/** p50 to p95 drawn as one bar: solid up to the median, faded out to the 95th percentile. */
export function LatencyRange({ p50, p95, max }: { p50: number | null; p95: number | null; max: number }) {
  if (p50 == null || p95 == null || max <= 0) return <div className="lrange" aria-hidden />;
  const a = Math.min(100, (p50 / max) * 100);
  const b = Math.min(100, (p95 / max) * 100);
  return (
    <div className="lrange" role="img" aria-label={`Median ${fmtDuration(p50)}, 95th percentile ${fmtDuration(p95)}`}>
      <i className="lr-p95" style={{ width: `${b}%` }} />
      <i className="lr-p50" style={{ width: `${a}%` }} />
    </div>
  );
}

const W = 600;
const H = 150;

/** Average duration per day, drawn with the same chart chrome as the uptime response chart. */
export function TrendChart({ points }: { points: TransactionTrendPoint[] }) {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return <p className="rc-empty">A trend line needs at least two days of data.</p>;

  const t0 = new Date(pts[0].date).getTime();
  const span = Math.max(1, new Date(pts[pts.length - 1].date).getTime() - t0);
  const max = Math.max(...pts.map((p) => p.avgDuration));
  const top = Math.max(10, max * 1.15);
  const x = (p: TransactionTrendPoint) => ((new Date(p.date).getTime() - t0) / span) * W;
  const y = (ms: number) => H - 4 - (ms / top) * (H - 12);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)} ${y(p.avgDuration).toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const fmt = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className="rchart">
      <span className="rc-y rc-top">{fmtDuration(top)}</span>
      <span className="rc-y rc-bot">0</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Average duration over time">
        <line className="grid" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
        <line className="grid" x1="0" x2={W} y1={H / 2} y2={H / 2} />
        <line className="grid" x1="0" x2={W} y1="0.5" y2="0.5" />
        <path className="area" d={area} />
        <path className="ln" d={line} />
      </svg>
      <div className="axis">
        <span>{fmt(t0)}</span>
        <span>{fmt(t0 + span / 2)}</span>
        <span>{fmt(t0 + span)}</span>
      </div>
    </div>
  );
}
