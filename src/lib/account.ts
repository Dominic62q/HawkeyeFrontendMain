import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./api";

const AUTH = "/_allauth/browser/v1";

export interface UserOptions {
  timezone: string | null;
  stacktraceOrder: number | null;
  language: string | null;
  clock24Hours: boolean | null;
  preferredTheme: string | null;
}

export interface UserIdentity {
  id: number;
  provider: string;
  uid: string;
  email: string | null;
  username: string | null;
  lastLogin: string;
  dateJoined: string;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  options: UserOptions;
  hasPasswordAuth: boolean;
  identities: UserIdentity[];
  isSuperuser?: boolean;
  dateJoined: string;
  lastLogin: string | null;
}

export interface UserEmail {
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface ApiToken {
  id: number;
  label: string;
  scopes: string[];
  token: string;
  created: string;
}

export const TOKEN_SCOPES = [
  { group: "Projects", scopes: ["project:read", "project:write", "project:admin", "project:releases"] },
  { group: "Teams", scopes: ["team:read", "team:write", "team:admin"] },
  { group: "Events", scopes: ["event:read", "event:write", "event:admin"] },
  { group: "Organization", scopes: ["org:read", "org:write", "org:admin"] },
  { group: "Members", scopes: ["member:read", "member:write", "member:admin"] },
] as const;

export const READ_SCOPES = TOKEN_SCOPES.flatMap((g) => g.scopes).filter((s) => s.endsWith(":read"));

// ---- profile

export function useUser() {
  return useQuery({ queryKey: ["user"], queryFn: () => api<UserDetail>("/api/0/users/me/") });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    // The API replaces every option it is sent, so the caller passes the full set.
    mutationFn: (input: { name: string; options: UserOptions }) =>
      api<UserDetail>("/api/0/users/me/", { method: "PUT", body: input }),
    onSuccess: (user) => qc.setQueryData<UserDetail>(["user"], (old) => (old ? { ...old, ...user } : old)),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ["user-notifications"],
    queryFn: () => api<{ subscribeByDefault: boolean }>("/api/0/users/me/notifications/"),
  });
}

export function useSetSubscribeByDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscribeByDefault: boolean) =>
      api<{ subscribeByDefault: boolean }>("/api/0/users/me/notifications/", {
        method: "PUT",
        body: { subscribeByDefault },
      }),
    onSuccess: (data) => qc.setQueryData(["user-notifications"], data),
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => api("/api/0/users/me/", { method: "DELETE" }) });
}

// ---- email addresses

export function useUserEmails() {
  return useQuery({
    queryKey: ["user-emails"],
    queryFn: () => api<UserEmail[]>("/api/0/users/me/emails/"),
  });
}

export function useEmailActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["user-emails"] });
  const url = "/api/0/users/me/emails/";
  return {
    add: useMutation({
      mutationFn: (email: string) => api<UserEmail>(url, { method: "POST", body: { email } }),
      onSuccess: refresh,
    }),
    makePrimary: useMutation({
      mutationFn: (email: string) => api<UserEmail>(url, { method: "PUT", body: { email } }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (email: string) => api(url, { method: "DELETE", body: { email } }),
      onSuccess: refresh,
    }),
    resend: useMutation({
      mutationFn: (email: string) => api(`${url}confirm/`, { method: "POST", body: { email } }),
    }),
  };
}

// ---- password

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword?: string; newPassword: string }) =>
      api(`${AUTH}/account/password/change`, {
        method: "POST",
        body: { current_password: input.currentPassword, new_password: input.newPassword },
      }),
  });
}

// ---- two-factor

interface TotpActive {
  active: true;
  createdAt: number;
  lastUsedAt: number | null;
}
interface TotpSetup {
  active: false;
  secret: string;
  url: string;
}
export type TotpState = TotpActive | TotpSetup;

interface AllauthBody<T> {
  data?: T;
  meta?: { secret?: string; totp_url?: string };
}

export function useTotp() {
  return useQuery({
    queryKey: ["totp"],
    queryFn: async (): Promise<TotpState> => {
      try {
        const res = await api<AllauthBody<{ created_at: number; last_used_at: number | null }>>(
          `${AUTH}/account/authenticators/totp`,
        );
        return { active: true, createdAt: res.data?.created_at ?? 0, lastUsedAt: res.data?.last_used_at ?? null };
      } catch (err) {
        // 404 means "not set up", and carries a fresh secret to enrol with.
        if (err instanceof ApiError && err.status === 404) {
          const meta = (err.body as AllauthBody<unknown> | null)?.meta;
          if (meta?.secret && meta.totp_url) return { active: false, secret: meta.secret, url: meta.totp_url };
        }
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useActivateTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api(`${AUTH}/account/authenticators/totp`, { method: "POST", body: { code } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["totp"] });
      await qc.invalidateQueries({ queryKey: ["recovery-codes"] });
    },
  });
}

export function useDeactivateTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`${AUTH}/account/authenticators/totp`, { method: "DELETE" }),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ["recovery-codes"] });
      await qc.invalidateQueries({ queryKey: ["totp"] });
    },
  });
}

export interface RecoveryCodes {
  total: number;
  unusedCount: number;
  /** Absent when the server won't show the codes again. */
  unused: string[] | null;
}

export function useRecoveryCodes(enabled: boolean) {
  return useQuery({
    queryKey: ["recovery-codes"],
    enabled,
    retry: false,
    queryFn: async (): Promise<RecoveryCodes | null> => {
      try {
        const res = await api<AllauthBody<{ total_code_count: number; unused_code_count: number; unused_codes?: string[] }>>(
          `${AUTH}/account/authenticators/recovery-codes`,
        );
        const unused = res.data?.unused_codes ?? null;
        return {
          total: res.data?.total_code_count ?? 0,
          unusedCount: res.data?.unused_code_count ?? unused?.length ?? 0,
          unused,
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

/** Previews a fresh set of recovery codes. Nothing changes until one is confirmed. */
export function usePreviewRecoveryCodes() {
  return useMutation({
    mutationFn: () => api<{ codes: string[] }>("/api/0/generate-recovery-codes/").then((r) => r.codes),
  });
}

export function useConfirmRecoveryCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api("/api/0/generate-recovery-codes/", { method: "POST", body: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recovery-codes"] }),
  });
}

// ---- connected accounts

export function useDisconnectIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (identity: UserIdentity) =>
      api(`${AUTH}/account/providers`, { method: "DELETE", body: { provider: identity.provider, account: identity.uid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user"] }),
  });
}

// ---- API tokens

export function useApiTokens() {
  return useQuery({ queryKey: ["api-tokens"], queryFn: () => api<ApiToken[]>("/api/0/api-tokens/") });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; scopes: string[] }) =>
      api<ApiToken>("/api/0/api-tokens/", { method: "POST", body: input }),
    onSuccess: (token) => qc.setQueryData<ApiToken[]>(["api-tokens"], (old) => [token, ...(old ?? [])]),
  });
}

export function useDeleteToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/0/api-tokens/${id}/`, { method: "DELETE" }),
    onSuccess: (_, id) => qc.setQueryData<ApiToken[]>(["api-tokens"], (old) => old?.filter((t) => t.id !== id)),
  });
}
