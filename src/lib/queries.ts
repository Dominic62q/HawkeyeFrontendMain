import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRaw } from "./api";
import type {
  Environment,
  Issue,
  IssueEvent,
  IssueStatus,
  Organization,
  Project,
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
