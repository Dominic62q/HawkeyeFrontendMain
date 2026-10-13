export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `Request failed with status ${status}`);
  }
}

function getCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.slice(name.length + 1);
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface Options {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
}

export interface ApiResponse<T> {
  data: T;
  headers: Headers;
}

export async function apiRaw<T>(
  path: string,
  { method = "GET", body, query }: Options = {},
): Promise<ApiResponse<T>> {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const token = getCookie("csrftoken");
    if (token) headers["X-CSRFToken"] = token;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return { data: data as T, headers: res.headers };
}

export async function api<T>(path: string, options?: Options): Promise<T> {
  return (await apiRaw<T>(path, options)).data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: { message?: string }[]; detail?: unknown } | null;
    const first = body?.errors?.[0]?.message;
    if (first) return first;
    if (typeof body?.detail === "string") return body.detail;
  }
  return "Something went wrong. Try again.";
}
