import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRaw } from "./api";
import type {
  Environment,
  Issue,
  IssueEvent,
  IssueStatus,
  Monitor,
  MonitorCheck,
  MonitorInput,
  Organization,
  Project,
  SpanGroup,
  TransactionGroup,
  TransactionTrendPoint,
} from "./types";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => api<Organization[]>("/api/0/organizations/"),
  });
}

export function useProjects(org: string) {
  return useQuery({
    queryKey: ["projects", org],
    queryFn: () => api<Project[]>(`/api/0/organizations/${org}/projects/`),
  });
}

export function useEnvironments(org: string) {
  return useQuery({
    queryKey: ["environments", org],
    queryFn: () => api<Environment[]>(`/api/0/organizations/${org}/environments/`),
  });
}

export interface IssueFilters {
  status: IssueStatus | "all";
  environment: string;
  project: string;
  period: "24h" | "14d";
  sort: IssueSort;
}

export type IssueSort = "-last_seen" | "-first_seen" | "-count" | "-priority";

export function useIssues(org: string, f: IssueFilters, search = "") {
  return useQuery({
    queryKey: ["issues", org, f, search],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // The period only picks which stats window is charted. The API's start/end
      // filter on first_seen, so sending them would hide older, still-open issues.
      const { data, headers } = await apiRaw<Issue[]>(`/api/0/organizations/${org}/issues/`, {
        query: {
          query: [f.status === "all" ? "" : `is:${f.status}`, search].filter(Boolean).join(" "),
          environment: f.environment || undefined,
          project: f.project || undefined,
          sort: f.sort,
          limit: 50,
        },
      });
      return { issues: data, total: Number(headers.get("x-hits") ?? data.length) };
    },
  });
}

export function useIssue(org: string, id: string) {
  return useQuery({
    queryKey: ["issue", org, id],
    queryFn: () => api<Issue>(`/api/0/organizations/${org}/issues/${id}/`),
  });
}

/** One event of an issue; without an id this is the most recent one. */
export function useEvent(issueId: string, eventId?: string) {
  return useQuery({
    queryKey: ["event", issueId, eventId ?? "latest"],
    queryFn: () => api<IssueEvent>(`/api/0/issues/${issueId}/events/${eventId ?? "latest"}/`),
    placeholderData: keepPreviousData,
  });
}

export function useBulkUpdateIssues(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: IssueStatus }) =>
      api(`/api/0/organizations/${org}/issues/?${ids.map((i) => `id=${encodeURIComponent(i)}`).join("&")}`, {
        method: "PUT",
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues", org] });
      qc.invalidateQueries({ queryKey: ["issue", org] });
    },
  });
}

export function useUpdateIssueStatus(org: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: IssueStatus) =>
      api<Issue>(`/api/0/issues/${id}/`, { method: "PUT", body: { status } }),
    onSuccess: (issue) => {
      qc.setQueryData(["issue", org, id], issue);
      qc.invalidateQueries({ queryKey: ["issues", org] });
    },
  });
}

export type MonitorSort = "status" | "name" | "-created";

const LIVE = 15_000;

/** Monitors with their 60 most recent checks; refreshes on its own like a status board should. */
export function useMonitors(org: string, sort: MonitorSort) {
  return useQuery({
    queryKey: ["monitors", org, sort],
    queryFn: () => api<Monitor[]>(`/api/0/organizations/${org}/monitors/`, { query: { sort, limit: 100 } }),
    refetchInterval: LIVE,
    placeholderData: keepPreviousData,
  });
}

export function useMonitor(org: string, id: string) {
  return useQuery({
    queryKey: ["monitor", org, id],
    queryFn: () => api<Monitor>(`/api/0/organizations/${org}/monitors/${id}/`),
    refetchInterval: LIVE,
  });
}

/** Up/down transitions only, newest first. */
export function useMonitorChanges(org: string, id: string) {
  return useQuery({
    queryKey: ["monitor-changes", org, id],
    queryFn: () =>
      api<MonitorCheck[]>(`/api/0/organizations/${org}/monitors/${id}/checks/`, {
        query: { is_change: true, limit: 50 },
      }),
    refetchInterval: LIVE,
  });
}

export function useSaveMonitor(org: string, id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MonitorInput) =>
      api<Monitor>(`/api/0/organizations/${org}/monitors/${id ? id + "/" : ""}`, {
        method: id ? "PUT" : "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors", org] });
      qc.invalidateQueries({ queryKey: ["monitor", org] });
    },
  });
}

export function useDeleteMonitor(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/0/organizations/${org}/monitors/${id}/`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      // Drop it from the cached lists now so the list doesn't flash the deleted row.
      qc.setQueriesData<Monitor[]>({ queryKey: ["monitors", org] }, (old) => old?.filter((m) => m.id !== id));
      qc.invalidateQueries({ queryKey: ["monitors", org] });
    },
  });
}

export type TransactionSort = "-avg_duration" | "-count" | "-created";

export function useTransactionGroups(org: string, sort: TransactionSort, project: string, query: string) {
  return useQuery({
    queryKey: ["transaction-groups", org, sort, project, query],
    queryFn: () =>
      api<TransactionGroup[]>(`/api/0/organizations/${org}/transaction-groups/`, {
        query: { sort, project: project || undefined, query: query || undefined },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useTransactionGroup(org: string, id: string) {
  return useQuery({
    queryKey: ["transaction-group", org, id],
    queryFn: () => api<TransactionGroup>(`/api/0/organizations/${org}/transaction-groups/${id}/`),
  });
}

export function useTransactionTrend(org: string, id: string) {
  return useQuery({
    queryKey: ["transaction-trend", org, id],
    queryFn: () => api<TransactionTrendPoint[]>(`/api/0/organizations/${org}/transaction-groups/${id}/trend/`),
  });
}

export function useTransactionSpans(org: string, id: string) {
  return useQuery({
    queryKey: ["transaction-spans", org, id],
    queryFn: () => api<SpanGroup[]>(`/api/0/organizations/${org}/transaction-groups/${id}/spans/`),
  });
}
