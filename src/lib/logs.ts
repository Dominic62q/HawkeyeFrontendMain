import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, apiRaw } from "./api";

export const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LEVELS)[number];

export const RANGES = [
  { id: "6h", label: "6h", span: "now-6h" },
  { id: "24h", label: "24h", span: "now-24h" },
  { id: "7d", label: "7d", span: "now-7d" },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export interface LogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  body: string;
  service: string;
  environment: string;
  host: string;
  traceID: string | null;
  spanID: string | null;
  severityNumber: number | null;
  data: Record<string, unknown>;
  projectId: number;
}

export interface LogFilters {
  range: RangeId;
  levels: LogLevel[];
  service: string;
  environment: string;
  host: string;
  traceId: string;
  query: string;
  project: string;
}

export interface LogStats {
  intervals: string[];
  series: { name: LogLevel; data: number[] }[];
}

export interface LogResource {
  name: string;
  type: "service" | "environment" | "host";
  lastSeen: string;
}

const PAGE = 100;

function spanOf(range: RangeId) {
  return RANGES.find((r) => r.id === range)?.span ?? "now-24h";
}

/** The API takes level as a repeated param, so build the query string by hand. */
function qs(f: LogFilters, extra: Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  p.set("start", spanOf(f.range));
  for (const l of f.levels) p.append("level", l);
  if (f.project) p.append("project", f.project);
  if (f.service) p.set("service", f.service);
  if (f.environment) p.set("environment", f.environment);
  if (f.host) p.set("host", f.host);
  if (f.traceId) p.set("traceId", f.traceId);
  if (f.query) p.set("query", f.query);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) p.set(k, String(v));
  return p.toString();
}

/** Pulls the cursor out of a Sentry-style Link header, if there is a next page. */
function nextCursor(link: string | null): string | undefined {
  const next = link?.split(",").find((part) => part.includes('rel="next"'));
  if (!next || next.includes('results="false"')) return undefined;
  return next.match(/cursor="([^"]+)"/)?.[1];
}

export function useLogs(org: string, f: LogFilters, live: boolean) {
  return useInfiniteQuery({
    queryKey: ["logs", org, f],
    placeholderData: keepPreviousData,
    refetchInterval: live ? 5000 : false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, headers } = await apiRaw<LogEvent[]>(
        `/api/0/organizations/${org}/logs/?${qs(f, { limit: PAGE, cursor: pageParam })}`,
      );
      return { logs: data, hits: Number(headers.get("x-hits") ?? data.length), next: nextCursor(headers.get("link")) };
    },
    getNextPageParam: (last) => last.next,
  });
}

export function useLogStats(org: string, f: LogFilters) {
  return useQuery({
    queryKey: ["log-stats", org, f.range, f.levels, f.service, f.environment, f.project],
    placeholderData: keepPreviousData,
    queryFn: () => {
      // Stats take lists for service and environment, and know nothing of host, trace or text.
      const p = new URLSearchParams();
      p.set("start", spanOf(f.range));
      for (const l of f.levels) p.append("level", l);
      if (f.project) p.append("project", f.project);
      if (f.service) p.append("service", f.service);
      if (f.environment) p.append("environment", f.environment);
      return api<LogStats>(`/api/0/organizations/${org}/logs/stats/?${p}`);
    },
  });
}

export function useLogResources(org: string, type: LogResource["type"]) {
  return useQuery({
    queryKey: ["log-resources", org, type],
    staleTime: 60_000,
    queryFn: () => api<LogResource[]>(`/api/0/organizations/${org}/logs/resources/`, { query: { resource_type: type } }),
  });
}

/** 14:02:09.341, with the date only when it isn't today. */
export function stamp(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`,
    date: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
  };
}
