import type { Monitor, MonitorCheck, MonitorType } from "./types";

export const MONITOR_TYPES: { id: MonitorType; label: string; hint: string }[] = [
  { id: "GET", label: "HTTP GET", hint: "Request a URL and check the status code" },
  { id: "POST", label: "HTTP POST", hint: "Send a POST and check the status code" },
  { id: "Ping", label: "Ping", hint: "Check that a URL responds at all" },
  { id: "TCP Port", label: "TCP port", hint: "Open a connection to host:port" },
  { id: "SSL", label: "SSL certificate", hint: "Watch a certificate's validity" },
  { id: "Heartbeat", label: "Heartbeat", hint: "Your job checks in; alert when it stops" },
];

const REASONS: Record<number, string> = {
  0: "Unknown failure",
  1: "Timed out",
  2: "Unexpected status code",
  3: "Expected text not found",
  4: "SSL error",
  5: "Network error",
};

export function reasonLabel(reason: number | null | undefined): string {
  return reason == null ? "Check failed" : (REASONS[reason] ?? "Check failed");
}

export type MonitorState = "up" | "down" | "pending";

export function stateOf(m: Pick<Monitor, "isUp">): MonitorState {
  return m.isUp === true ? "up" : m.isUp === false ? "down" : "pending";
}

/** Share of the given checks that passed, or null when there are none. */
export function uptimePct(checks: Pick<MonitorCheck, "isUp">[]): number | null {
  if (checks.length === 0) return null;
  return (checks.filter((c) => c.isUp).length / checks.length) * 100;
}

export function formatPct(p: number | null): string {
  if (p === null) return "–";
  if (p === 100) return "100%";
  return `${p >= 99 ? p.toFixed(2) : p.toFixed(1)}%`;
}

export function intervalLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${+(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${+(seconds / 3600).toFixed(1)} hr`;
  return `${+(seconds / 86400).toFixed(1)} d`;
}

/** "3h 12m", "45s": a span with no "ago", for "up for …" style text. */
export function span(fromIso: string | number, to: number = Date.now()): string {
  const secs = Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function avgResponse(checks: MonitorCheck[]): number | null {
  const times = checks.filter((c) => c.isUp && c.responseTime != null).map((c) => c.responseTime as number);
  if (times.length === 0) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "–";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
