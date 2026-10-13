import type { MonitorCheck } from "../lib/types";
import { formatMs } from "../lib/uptime";

/**
 * One slim bar per check, oldest on the left. Short histories are padded with
 * empty slots so a new monitor does not look like it has stretched bars.
 */
export function CheckBars({
  checks,
  slots = 60,
  tall = false,
}: {
  checks: Pick<MonitorCheck, "isUp">[];
  slots?: number;
  tall?: boolean;
}) {
  const ordered = [...checks].reverse().slice(-slots);
  const pad = slots - ordered.length;
  const down = ordered.filter((c) => !c.isUp).length;
  const slot = 240 / slots;
  return (
    <svg
      className={`cbars ${tall ? "tall" : ""}`}
      viewBox="0 0 240 28"
      preserveAspectRatio="none"
      role="img"
      aria-label={
        ordered.length === 0
          ? "No checks yet"
          : `Last ${ordered.length} checks: ${ordered.length - down} passed, ${down} failed`
      }
    >
      {Array.from({ length: slots }, (_, i) => {
        const check = i < pad ? undefined : ordered[i - pad];
        return (
          <rect
            key={i}
            className={check === undefined ? "none" : check.isUp ? "up" : "down"}
            x={i * slot + slot * 0.18}
            y="2"
            width={slot * 0.64}
            height="24"
            rx="1"
          />
        );
      })}
    </svg>
  );
}

const W = 600;
const H = 150;

interface Pt {
  t: number;
  ms: number | null;
  up: boolean;
}

/** Response time over the recent checks. Failed checks are marked as red columns. */
export function ResponseChart({ checks }: { checks: MonitorCheck[] }) {
  const pts: Pt[] = [...checks]
    .reverse()
    .map((c) => ({ t: new Date(c.startCheck).getTime(), ms: c.responseTime ?? null, up: c.isUp }));
  const timed = pts.filter((p) => p.up && p.ms != null);
  if (timed.length < 2) {
    return <p className="rc-empty">Response times will chart here once a few checks have run.</p>;
  }

  const t0 = pts[0].t;
  const span = Math.max(1, pts[pts.length - 1].t - t0);
  const maxMs = Math.max(...timed.map((p) => p.ms as number));
  const top = Math.max(10, Math.ceil((maxMs * 1.15) / 10) * 10);
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (ms: number) => H - 4 - (ms / top) * (H - 12);

  // Break the line wherever a failed check interrupts it.
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of pts) {
    if (p.up && p.ms != null) cur.push(p);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);

  const line = (run: Pt[]) => run.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.ms as number).toFixed(1)}`).join(" ");
  const area = (run: Pt[]) =>
    `${line(run)} L${x(run[run.length - 1].t).toFixed(1)} ${H} L${x(run[0].t).toFixed(1)} ${H} Z`;
  const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rchart">
      <span className="rc-y rc-top">{formatMs(top)}</span>
      <span className="rc-y rc-bot">0</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Response time over recent checks">
        <line className="grid" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
        <line className="grid" x1="0" x2={W} y1={H / 2} y2={H / 2} />
        <line className="grid" x1="0" x2={W} y1="0.5" y2="0.5" />
        {pts
          .filter((p) => !p.up)
          .map((p, i) => (
            <rect key={i} className="fail" x={x(p.t) - 2} y="0" width="4" height={H} />
          ))}
        {runs.map((run, i) => (
          <g key={i}>
            <path className="area" d={area(run)} />
            <path className="ln" d={line(run)} />
          </g>
        ))}
      </svg>
      <div className="axis">
        <span>{fmt(t0)}</span>
        <span>{fmt(t0 + span / 2)}</span>
        <span>{fmt(t0 + span)}</span>
      </div>
    </div>
  );
}
