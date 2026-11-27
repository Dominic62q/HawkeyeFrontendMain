import { api, ApiError } from "./api";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantContext {
  project?: string;
  projectName?: string;
  route?: string;
  issueId?: string;
  transactionId?: string;
  monitorId?: string;
}

export interface AssistantResponse {
  reply: string;
  toolsUsed: string[];
  model: string;
  sessionId: string;
  threadId: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  projectName: string;
  updatedAt: string;
  messageCount: number;
}

export interface ThreadDetail {
  id: string;
  title: string;
  projectName: string;
  sessionId: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

export async function sendAssistantChat(
  org: string,
  body: {
    messages: AssistantMessage[];
    threadId?: string;
    sessionId?: string;
    context?: AssistantContext;
  },
  options: {
    signal?: AbortSignal;
    onStatus?: (message: string) => void;
    onText?: (text: string) => void;
    onReset?: () => void;
  } = {},
): Promise<AssistantResponse> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  const token = document.cookie.split("; ").find((c) => c.startsWith("csrftoken="))?.slice("csrftoken=".length);
  if (token) headers["X-CSRFToken"] = token;
  const res = await fetch(new URL(`/api/0/organizations/${org}/assistant/chat/`, window.location.origin), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "same-origin",
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    throw new ApiError(res.status, data);
  }
  if (!res.body || !res.headers.get("content-type")?.toLowerCase().startsWith("text/event-stream")) {
    throw new Error("Assistant returned an invalid stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let data: string[] = [];
  let result: AssistantResponse | undefined;
  const dispatch = () => {
    if (!data.length) { event = ""; return; }
    let payload: unknown;
    try { payload = JSON.parse(data.join("\n")); } catch { throw new Error("Invalid assistant stream event."); }
    data = [];
    const value = payload as Record<string, unknown> | null;
    if (event === "status") {
      if (typeof value?.message !== "string") throw new Error("Invalid assistant status.");
      options.onStatus?.(value.message);
    } else if (event === "text") {
      if (typeof value?.text !== "string") throw new Error("Invalid assistant text.");
      options.onText?.(value.text);
    } else if (event === "reset") {
      options.onReset?.();
    } else if (event === "error") {
      throw new Error(typeof value?.message === "string" ? value.message : "Assistant stream failed.");
    } else if (event === "done") {
      if (typeof value?.reply !== "string" || !Array.isArray(value.toolsUsed) ||
          !value.toolsUsed.every((tool) => typeof tool === "string") ||
          typeof value.model !== "string" || typeof value.sessionId !== "string" ||
          typeof value.threadId !== "string") throw new Error("Invalid assistant completion.");
      result = value as unknown as AssistantResponse;
    }
    event = "";
  };
  const processLines = (final: boolean) => {
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      if (char !== "\n" && char !== "\r") continue;
      if (char === "\r" && i === buffer.length - 1 && !final) break;
      const line = buffer.slice(start, i);
      if (char === "\r" && buffer[i + 1] === "\n") i++;
      start = i + 1;
      if (!line) dispatch();
      else if (!line.startsWith(":")) {
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (result) break;
    }
    buffer = buffer.slice(start);
  };
  try {
    while (!result) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      processLines(chunk.done);
      if (chunk.done) break;
    }
    if (!result) throw new Error("Assistant response was interrupted.");
    return result;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function listAssistantThreads(org: string) {
  return api<ThreadSummary[]>(`/api/0/organizations/${org}/assistant/threads/`);
}

export function getAssistantThread(org: string, threadId: string) {
  return api<ThreadDetail>(`/api/0/organizations/${org}/assistant/threads/${threadId}/`);
}

export function deleteAssistantThread(org: string, threadId: string) {
  return api<void>(`/api/0/organizations/${org}/assistant/threads/${threadId}/`, {
    method: "DELETE",
  });
}

export function clearAssistantThreads(org: string) {
  return api<void>(`/api/0/organizations/${org}/assistant/threads/`, {
    method: "DELETE",
  });
}

export interface AssistantSettings {
  enabled: boolean;
  scrubPii: boolean;
}

export function getAssistantSettings(org: string) {
  return api<AssistantSettings>(`/api/0/organizations/${org}/assistant/settings/`);
}

export function updateAssistantSettings(org: string, body: AssistantSettings) {
  return api<AssistantSettings>(`/api/0/organizations/${org}/assistant/settings/`, {
    method: "PUT",
    body,
  });
}

type Listener = (prompt?: string) => void;
const listeners = new Set<Listener>();

export function openAssistant(prompt?: string) {
  listeners.forEach((fn) => fn(prompt));
}

export function subscribeAssistantOpen(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
