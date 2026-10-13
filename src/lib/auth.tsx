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
  constructor() {
    super("Two-factor authentication is required for this account.");
  }
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
      if (err instanceof ApiError && err.status === 401) {
        const flows = (err.body as { data?: { flows?: { id: string; is_pending?: boolean }[] } })
          ?.data?.flows;
        if (flows?.some((f) => f.is_pending && f.id.startsWith("mfa"))) throw new MfaRequiredError();
      }
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

  const user = session.data ?? null;
  const status = session.isLoading ? "loading" : user ? "authed" : "anon";
  return <AuthContext value={{ status, user, login, logout }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
