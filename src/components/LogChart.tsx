import { LEVELS, type LogStats, type RangeId } from "../lib/logs";

const HOUR = 3_600_000;
const HOURS: Record<RangeId, number> = { "6h": 6, "24h": 24, "7d": 168 };

/** Stacked bars of log volume, one per hour, coloured by level. */
export function LogChart({ stats, range }: { stats: LogStats | undefined; range: RangeId }) {
  const n = HOURS[range];
  const end = Math.floor(Date.now() / HOUR) * HOUR;
  const start = end - (n - 1) * HOUR;

  // The API leaves out hours that had no logs, so lay the data over a full set of hours.
  const buckets = Array.from({ length: n }, () => Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<string, number>);
  for (const s of stats?.series ?? []) {
    s.data.forEach((count, i) => {
      const slot = Math.round((new Date(stats!.intervals[i]).getTime() - start) / HOUR);
      if (slot >= 0 && slot < n) buckets[slot][s.name] += count;
    });
  }
  const totals = buckets.map((b) => LEVELS.reduce((sum, l) => sum + b[l], 0));
  const max = Math.max(...totals, 1);
  const empty = totals.every((t) => t === 0);
  const w = 600 / n;
  const gap = n > 48 ? 0.5 : 2;

  return (
    <>
      <svg
        className="pulse logbars"
        viewBox="0 0 600 150"
        preserveAspectRatio="none"
        role="img"
        aria-label={empty ? "No logs in this period" : "Log volume per hour, by level"}
      >
        {buckets.map((b, i) => {
          let y = 150;
          const when = new Date(start + i * HOUR).toLocaleString(undefined, { weekday: "short", hour: "numeric" });
          return (
            <g key={i}>
              <title>
                {when} · {totals[i]} {totals[i] === 1 ? "log" : "logs"}
              </title>
              {totals[i] === 0 ? (
                <rect className="flat" x={i * w + gap / 2} y={146} width={Math.max(w - gap, 0.5)} height={4} rx="1" />
              ) : (
                LEVELS.map((l) => {
                  if (b[l] === 0) return null;
                  const h = Math.max(2, (b[l] / max) * 146);
                  y -= h;
                  return <rect key={l} className={`lv-${l}`} x={i * w + gap / 2} y={y} width={Math.max(w - gap, 0.5)} height={h} />;
                })
              )}
            </g>
          );
        })}
      </svg>
      <div className="axis">
        <span>{range === "7d" ? "7d ago" : `${n}h ago`}</span>
        <span>{range === "7d" ? "3.5d" : `${n / 2}h`}</span>
        <span>now</span>
      </div>
    </>
  );
}
