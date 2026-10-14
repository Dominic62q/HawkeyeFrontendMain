import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

// Read-only operator metadata. The backend only answers an active superuser's session.

export interface UsageWindow {
  last30Days: number;
  last24Hours: number;
}

export interface Overview {
  organizations: { total: number; active: number; paused: number; throttled: number; new: number };
  users: { total: number; active: number; superusers: number; recent: number; new: number };
  projects: number;
  usage: {
    issueEvents: UsageWindow;
    transactions: UsageWindow;
    logs: UsageWindow;
    uptimeChecks: UsageWindow;
  };
  usageWindowDays: number;
}

export interface OrgRow {
  id: number;
  name: string;
  slug: string;
  created: string;
  isActive: boolean;
  isAcceptingEvents: boolean;
  eventThrottleRate: number;
  memberCount: number;
  projectCount: number;
  events30Days: number;
}

export interface OrgMember {
  id: number;
  email: string | null;
  name: string;
  role: string;
  pending: boolean;
  lastLogin: string | null;
  created: string;
}

export interface OrgProject {
  id: number;
  name: string;
  slug: string;
  platform: string | null;
  created: string;
  firstEvent: string | null;
}

export interface OrgDetail {
  id: number;
  name: string;
  slug: string;
  created: string;
  isActive: boolean;
  isAcceptingEvents: boolean;
  eventThrottleRate: number;
  periodStart: string | null;
  periodEnd: string | null;
  usage: {
    issueEvents: number;
    transactions: number;
    logs: number;
    uptimeChecks: number;
    fileSizeMb: number;
    billedTotal: number;
  };
  members: OrgMember[];
  projects: OrgProject[];
}

export interface UserRow {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  isSuperuser: boolean;
  created: string;
  lastLogin: string | null;
  organizationCount: number;
}

export interface Page<T> {
  count: number;
  page: number;
  pageSize: number;
  results: T[];
}

export function useOverview() {
  return useQuery({
    queryKey: ["operator", "overview"],
    queryFn: () => api<Overview>("/api/0/operator/overview/"),
    retry: false,
  });
}

export function useOperatorOrgs(q: string, page: number) {
  return useQuery({
    queryKey: ["operator", "orgs", q, page],
    queryFn: () => api<Page<OrgRow>>("/api/0/operator/organizations/", { query: { q, page } }),
    placeholderData: keepPreviousData,
  });
}

export function useOperatorOrg(id: string) {
  return useQuery({
    queryKey: ["operator", "org", id],
    queryFn: () => api<OrgDetail>(`/api/0/operator/organizations/${id}/`),
  });
}

export function useOperatorUsers(q: string, page: number) {
  return useQuery({
    queryKey: ["operator", "users", q, page],
    queryFn: () => api<Page<UserRow>>("/api/0/operator/users/", { query: { q, page } }),
    placeholderData: keepPreviousData,
  });
}

// ---- actions. Each one is confirmed in the UI and logged on the server.

export function useSetIngest(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accepting: boolean) =>
      api<{ isAcceptingEvents: boolean }>(`/api/0/operator/organizations/${orgId}/ingest/`, {
        method: "POST",
        body: { accepting },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator"] }),
  });
}

export function useSetUserActive(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) =>
      api<{ isActive: boolean }>(`/api/0/operator/users/${userId}/active/`, {
        method: "POST",
        body: { active },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator"] }),
  });
}
