import type { TransactionGroup } from "./types";

/** Durations arrive as fractional milliseconds; show them the way a person would say them. */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "–";
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function fmtRate(perMinute: number | null | undefined): string {
  if (perMinute == null) return "–";
  if (perMinute >= 100) return `${Math.round(perMinute)}/min`;
  if (perMinute >= 1) return `${perMinute.toFixed(1)}/min`;
  return `${(perMinute * 60).toFixed(1)}/hr`;
}

export function fmtErrorRate(pct: number): string {
  if (pct === 0) return "0%";
  return pct < 0.1 ? "<0.1%" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

export function errorTone(pct: number): "ok" | "warn" | "bad" {
  return pct >= 5 ? "bad" : pct >= 1 ? "warn" : "ok";
}

export function totals(groups: TransactionGroup[]) {
  const requests = groups.reduce((a, g) => a + g.count, 0);
  const errors = groups.reduce((a, g) => a + g.errorCount, 0);
  const slowest = groups.reduce<TransactionGroup | null>((m, g) => ((g.p95 ?? 0) > (m?.p95 ?? 0) ? g : m), null);
  return { requests, errors, errorRate: requests ? (errors / requests) * 100 : 0, slowest };
}

export function opLabel(op: string): string {
  return op || "transaction";
}
