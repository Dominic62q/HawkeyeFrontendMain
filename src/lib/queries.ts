import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRaw } from "./api";
import type {
  Environment,
  InviteInfo,
  ServerSettings,
  Member,
  MemberInvite,
  OrganizationDetail,
  OrgRole,
  ProjectAlert,
  ProjectDetail,
  ProjectKey,
  Team,
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

/* ---- settings ---- */

export function useOrgDetail(org: string) {
  return useQuery({
    queryKey: ["org-detail", org],
    queryFn: () => api<OrganizationDetail>(`/api/0/organizations/${org}/`),
  });
}

/** Everything under settings that can change what the org looks like. */
function useRefreshOrg(org: string) {
  const qc = useQueryClient();
  return () => {
    for (const key of ["org-detail", "org-projects", "teams", "projects", "organizations"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    void org;
  };
}

export function useUpdateOrg(org: string) {
  const qc = useQueryClient();
  const refresh = useRefreshOrg(org);
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api<OrganizationDetail>(`/api/0/organizations/${org}/`, { method: "PUT", body: input }),
    onSuccess: (saved) => {
      // Show the saved name right away instead of waiting on the refetch.
      qc.setQueryData<OrganizationDetail>(["org-detail", org], saved);
      refresh();
    },
  });
}

export function useOrgProjects(org: string) {
  return useQuery({
    queryKey: ["org-projects", org],
    queryFn: () => api<ProjectDetail[]>(`/api/0/organizations/${org}/projects/`),
  });
}

export interface ProjectInput {
  name: string;
  platform?: string | null;
}

export function useCreateProject(org: string) {
  const refresh = useRefreshOrg(org);
  return useMutation({
    mutationFn: ({ team, ...input }: ProjectInput & { team: string }) =>
      api<ProjectDetail>(`/api/0/teams/${org}/${team}/projects/`, { method: "POST", body: input }),
    onSuccess: refresh,
  });
}

export function useUpdateProject(org: string, slug: string) {
  const qc = useQueryClient();
  const refresh = useRefreshOrg(org);
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      api<ProjectDetail>(`/api/0/projects/${org}/${slug}/`, { method: "PUT", body: input }),
    onSuccess: (saved) => {
      qc.setQueryData<ProjectDetail[]>(["org-projects", org], (old) =>
        old?.map((p) => (p.slug === slug ? { ...p, name: saved.name, platform: saved.platform } : p)),
      );
      refresh();
    },
  });
}

export function useDeleteProject(org: string, slug: string) {
  const qc = useQueryClient();
  const refresh = useRefreshOrg(org);
  return useMutation({
    mutationFn: () => api(`/api/0/projects/${org}/${slug}/`, { method: "DELETE" }),
    onSuccess: () => {
      // The org endpoint keeps listing a deleted project until cleanup runs, so patch the list we read instead.
      qc.setQueryData<ProjectDetail[]>(["org-projects", org], (old) => old?.filter((p) => p.slug !== slug));
      refresh();
    },
  });
}

export function useProjectKeys(org: string, slug: string) {
  return useQuery({
    queryKey: ["keys", org, slug],
    queryFn: () => api<ProjectKey[]>(`/api/0/projects/${org}/${slug}/keys/`),
  });
}

export function useCreateKey(org: string, slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<ProjectKey>(`/api/0/projects/${org}/${slug}/keys/`, { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys", org, slug] }),
  });
}

export function useDeleteKey(org: string, slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/0/projects/${org}/${slug}/keys/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys", org, slug] }),
  });
}

export function useTeams(org: string) {
  return useQuery({
    queryKey: ["teams", org],
    queryFn: () => api<Team[]>(`/api/0/organizations/${org}/teams/`),
  });
}

export function useCreateTeam(org: string) {
  const refresh = useRefreshOrg(org);
  return useMutation({
    mutationFn: (slug: string) => api<Team>(`/api/0/organizations/${org}/teams/`, { method: "POST", body: { slug } }),
    onSuccess: refresh,
  });
}

export function useDeleteTeam(org: string) {
  const refresh = useRefreshOrg(org);
  return useMutation({
    mutationFn: (slug: string) => api(`/api/0/teams/${org}/${slug}/`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useMembers(org: string) {
  return useQuery({
    queryKey: ["members", org],
    queryFn: () => api<Member[]>(`/api/0/organizations/${org}/members/`),
  });
}

export function useInviteMember(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; orgRole: OrgRole }) =>
      api<MemberInvite>(`/api/0/organizations/${org}/members/`, {
        method: "POST",
        body: { ...input, teamRoles: [], sendInvite: true, reinvite: true },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", org] }),
  });
}

export function useUpdateMember(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, orgRole }: { id: string; orgRole: OrgRole }) =>
      api<Member>(`/api/0/organizations/${org}/members/${id}/`, { method: "PUT", body: { orgRole, teamRoles: [] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", org] }),
  });
}

export function useRemoveMember(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/0/organizations/${org}/members/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", org] }),
  });
}

export function useAlerts(org: string, slug: string) {
  return useQuery({
    queryKey: ["alerts", org, slug],
    queryFn: () => api<ProjectAlert[]>(`/api/0/projects/${org}/${slug}/alerts/`),
  });
}

export interface AlertInput {
  name: string;
  quantity: number | null;
  timespanMinutes: number | null;
  uptime: boolean;
  environments: string[];
  alertRecipients: { recipientType: string; url: string; tagsToAdd: string[] }[];
}

export interface AlertTestResult {
  recipientType: string;
  status: "sent" | "error" | "skipped";
  message: string | null;
}

export function useSaveAlert(org: string, slug: string, id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AlertInput) =>
      api<ProjectAlert>(`/api/0/projects/${org}/${slug}/alerts/${id ? id + "/" : ""}`, {
        method: id ? "PUT" : "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", org, slug] }),
  });
}

export function useDeleteAlert(org: string, slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/0/projects/${org}/${slug}/alerts/${id}/`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.setQueryData<ProjectAlert[]>(["alerts", org, slug], (old) => old?.filter((a) => a.id !== id));
      qc.invalidateQueries({ queryKey: ["alerts", org, slug] });
    },
  });
}

export function useTestAlert(org: string, slug: string) {
  return useMutation({
    mutationFn: (id: number) =>
      api<AlertTestResult[]>(`/api/0/projects/${org}/${slug}/alerts/${id}/test/`, { method: "POST" }),
  });
}

/** Public server settings: whether signup is open, which social logins exist, whether email works. */
export function useSettings() {
  return useQuery({
    queryKey: ["server-settings"],
    queryFn: () => api<ServerSettings>("/api/settings/"),
    staleTime: 5 * 60_000,
  });
}

export function useInvite(orgUserId: string, token: string) {
  return useQuery({
    queryKey: ["invite", orgUserId, token],
    queryFn: () => api<InviteInfo>(`/api/0/accept/${orgUserId}/${token}/`),
    retry: false,
  });
}

export function useAcceptInvite(orgUserId: string, token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<InviteInfo>(`/api/0/accept/${orgUserId}/${token}/`, { method: "POST", body: { acceptInvite: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Organization>("/api/0/organizations/", { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}
