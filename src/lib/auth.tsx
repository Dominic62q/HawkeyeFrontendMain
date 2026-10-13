import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./api";

const BASE = "/_allauth/browser/v1";

interface SessionPayload {
  data?: { user?: { email?: string; display?: string } };
  meta?: { is_authenticated?: boolean };
}

export interface User {
  email: string;
}

interface AuthState {
  status: "loading" | "authed" | "anon";
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<"authed" | "verify">;
  requestReset: (email: string) => Promise<void>;
  checkResetKey: (key: string) => Promise<boolean>;
  resetPassword: (key: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchSession(): Promise<User | null> {
  try {
    const res = await api<SessionPayload>(`${BASE}/auth/session`);
    const email = res.data?.user?.email ?? res.data?.user?.display;
    return res.meta?.is_authenticated && email ? { email } : null;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 410)) return null;
    throw err;
  }
}

export class MfaRequiredError extends Error {
  /** Which second factors the account can use, e.g. totp, recovery_codes, webauthn. */
  constructor(public types: string[] = []) {
    super("Two-factor authentication is required for this account.");
  }
}

interface Flow {
  id: string;
  is_pending?: boolean;
  types?: string[];
}

function pendingFlows(err: unknown): Flow[] {
  if (!(err instanceof ApiError) || err.status !== 401) return [];
  return (err.body as { data?: { flows?: Flow[] } } | null)?.data?.flows ?? [];
}

/** Redirects to a social provider. allauth only accepts this as a real form POST. */
export async function socialRedirect(provider: string, callbackUrl: string) {
  await api(`${BASE}/config`);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${BASE}/auth/provider/redirect`;
  const token = document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrftoken="))
    ?.slice("csrftoken=".length);
  const fields: Record<string, string> = {
    provider,
    process: "login",
    callback_url: callbackUrl,
    csrfmiddlewaretoken: token ?? "",
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** A same-origin path to return to after signing in, never an external URL. */
export function safeNext(raw: string | null | undefined): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: fetchSession, retry: false });

  const login = async (email: string, password: string) => {
    // The config call makes Django set the csrftoken cookie before we POST.
    await api(`${BASE}/config`);
    try {
      await api(`${BASE}/auth/login`, { method: "POST", body: { email, password } });
    } catch (err) {
      const mfa = pendingFlows(err).find((f) => f.is_pending && f.id.startsWith("mfa"));
      if (mfa) throw new MfaRequiredError(mfa.types);
      throw err;
    }
    await qc.invalidateQueries({ queryKey: ["session"] });
  };

  const logout = async () => {
    try {
      await api(`${BASE}/auth/session`, { method: "DELETE" });
    } catch (err) {
      // allauth answers 401 once the session is gone, which is the outcome we want.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    // Drop every cached org/issue, but keep the session query alive so the UI flips to "anon".
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    qc.setQueryData(["session"], null);
  };

  const verifyMfa = async (code: string) => {
    await api(`${BASE}/auth/2fa/authenticate`, { method: "POST", body: { code } });
    await qc.invalidateQueries({ queryKey: ["session"] });
  };

  const signup = async (email: string, password: string) => {
    await api(`${BASE}/config`);
    try {
      await api(`${BASE}/auth/signup`, { method: "POST", body: { email, password } });
    } catch (err) {
      // A 401 that is waiting on email verification means the account was created.
      if (pendingFlows(err).some((f) => f.id === "verify_email" && f.is_pending)) return "verify";
      throw err;
    }
    await qc.invalidateQueries({ queryKey: ["session"] });
    return "authed";
  };

  const requestReset = async (email: string) => {
    await api(`${BASE}/config`);
    await api(`${BASE}/auth/password/request`, { method: "POST", body: { email } });
  };

  const checkResetKey = async (key: string) => {
    try {
      await api(`${BASE}/auth/password/reset`, { headers: { "X-Password-Reset-Key": key } });
      return true;
    } catch {
      return false;
    }
  };

  const resetPassword = async (key: string, password: string) => {
    await api(`${BASE}/config`);
    try {
      await api(`${BASE}/auth/password/reset`, { method: "POST", body: { key, password } });
    } catch (err) {
      // allauth answers 401 once the password is set, because the user still has to sign in.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    await qc.invalidateQueries({ queryKey: ["session"] });
  };

  const user = session.data ?? null;
  const status = session.isLoading ? "loading" : user ? "authed" : "anon";
  return <AuthContext value={{ status, user, login, logout, verifyMfa, signup, requestReset, checkResetKey, resetPassword }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
