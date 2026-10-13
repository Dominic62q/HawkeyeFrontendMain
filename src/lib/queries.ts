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
}

export function useIssues(org: string, f: IssueFilters, search = "") {
  return useQuery({
    queryKey: ["issues", org, f, search],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const days = f.period === "24h" ? 1 : 14;
      const { data, headers } = await apiRaw<Issue[]>(`/api/0/organizations/${org}/issues/`, {
        query: {
          query: [f.status === "all" ? "" : `is:${f.status}`, search].filter(Boolean).join(" "),
          environment: f.environment || undefined,
          project: f.project || undefined,
          sort: "-last_seen",
          limit: 50,
          start: new Date(Date.now() - days * 86_400_000).toISOString(),
          end: new Date().toISOString(),
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

export function useLatestEvent(id: string) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: () => api<IssueEvent>(`/api/0/issues/${id}/events/latest/`),
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
