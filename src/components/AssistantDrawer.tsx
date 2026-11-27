import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { timeAgo } from "../lib/format";
import {
  clearAssistantThreads,
  deleteAssistantThread,
  getAssistantThread,
  listAssistantThreads,
  sendAssistantChat,
  subscribeAssistantOpen,
  type AssistantContext,
  type AssistantMessage,
} from "../lib/assistant";

interface Props {
  open: boolean;
  onClose: () => void;
  org: string;
  project: string;
  projectName: string;
}

function parseRouteContext(pathname: string, project: string, projectName: string): AssistantContext {
  const issueMatch = pathname.match(/\/issues\/([^/]+)/);
  const txMatch = pathname.match(/\/performance\/([^/]+)/);
  const monMatch = pathname.match(/\/uptime\/([^/]+)/);
  return {
    project: project || undefined,
    projectName: project ? projectName : undefined,
    route: pathname,
    issueId: issueMatch?.[1],
    transactionId: txMatch?.[1],
    monitorId: monMatch?.[1],
  };
}

function starterPrompts(ctx: AssistantContext): string[] {
  if (ctx.issueId) {
    return [
      "Explain the root cause of this issue and suggest a fix.",
      "What environments, users, or breadcrumbs stand out here?",
      "Are there related errors or logs around this failure?",
    ];
  }
  if (ctx.transactionId) {
    return [
      "Why is this transaction slow, and what spans dominate p95?",
      "Check if this project has N+1 database query patterns.",
      "What errors are affecting this endpoint?",
    ];
  }
  if (ctx.route?.endsWith("/performance")) {
    return [
      "Which endpoints have the worst p95 latency or error rate?",
      "Check for N+1 database queries across this scope.",
      "Summarize overall performance health.",
    ];
  }
  if (ctx.route?.endsWith("/logs")) {
    return [
      "Summarize recent error and warning logs.",
      "Which service is emitting the most errors right now?",
      "Find any anomalies or repeated failure messages in logs.",
    ];
  }
  if (ctx.route?.endsWith("/uptime")) {
    return [
      "Which monitors are down or unstable right now?",
      "Summarize uptime status and recent alerts.",
    ];
  }
  return [
    "What are the highest-impact unresolved issues right now?",
    "Check for slow endpoints or N+1 queries.",
    "Give me a quick health summary of this scope.",
  ];
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="ai-icode">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{renderInline(part.slice(2, -2))}</strong>;
    }
    return part;
  });
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function RichText({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="ai-prose">
      {blocks.map((block, i) => {
        if (block.startsWith("```") && block.endsWith("```")) {
          const inner = block.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, "");
          return (
            <pre key={i} className="ai-pre">
              <code>{inner.trimEnd()}</code>
            </pre>
          );
        }
        const lines = block.split("\n");
        const out: ReactNode[] = [];
        for (let j = 0; j < lines.length; j++) {
          const trimmed = lines[j].trim();
          if (!trimmed) {
            out.push(<div key={j} className="ai-gap" />);
            continue;
          }
          if (
            trimmed.startsWith("|") &&
            j + 1 < lines.length &&
            lines[j + 1].trim().startsWith("|") &&
            isTableSeparator(lines[j + 1])
          ) {
            const headers = splitTableRow(trimmed);
            j += 2;
            const rows: string[][] = [];
            while (j < lines.length && lines[j].trim().startsWith("|")) {
              rows.push(splitTableRow(lines[j]));
              j++;
            }
            j--;
            out.push(
              <div key={`tbl-${j}`} className="ai-tbl-wrap">
                <table className="ai-tbl">
                  <thead>
                    <tr>
                      {headers.map((h, hi) => (
                        <th key={hi}>{renderInline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, ri) => (
                      <tr key={ri}>
                        {headers.map((_, ci) => (
                          <td key={ci}>{renderInline(r[ci] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>,
            );
            continue;
          }
          if (trimmed.startsWith("### ")) {
            out.push(<h4 key={j}>{renderInline(trimmed.slice(4))}</h4>);
          } else if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
            out.push(<h3 key={j}>{renderInline(trimmed.replace(/^#{1,3}\s+/, ""))}</h3>);
          } else if (trimmed.startsWith("> ")) {
            out.push(
              <blockquote key={j} className="ai-quote">
                {renderInline(trimmed.slice(2))}
              </blockquote>,
            );
          } else if (/^[-*]\s+/.test(trimmed)) {
            out.push(
              <div key={j} className="ai-li">
                <span className="ai-bullet">·</span>
                <span>{renderInline(trimmed.replace(/^[-*]\s+/, ""))}</span>
              </div>,
            );
          } else if (/^\d+\.\s+/.test(trimmed)) {
            const m = trimmed.match(/^(\d+\.)\s+(.*)$/);
            out.push(
              <div key={j} className="ai-li num">
                <span className="ai-num">{m?.[1]}</span>
                <span>{renderInline(m?.[2] ?? trimmed)}</span>
              </div>,
            );
          } else {
            out.push(<p key={j}>{renderInline(trimmed)}</p>);
          }
        }
        return <Fragment key={i}>{out}</Fragment>;
      })}
    </div>
  );
}

// Keep destructive actions and sends serialized even if the drawer is remounted
// after switching away from and back to an organization.
const orgActivity = new Map<string, number>();
const activityListeners = new Set<() => void>();

function changeOrgActivity(org: string, delta: number) {
  const next = (orgActivity.get(org) ?? 0) + delta;
  if (next) orgActivity.set(org, next);
  else orgActivity.delete(org);
  activityListeners.forEach((listener) => listener());
}

function subscribeActivity(listener: () => void) {
  activityListeners.add(listener);
  return () => { activityListeners.delete(listener); };
}

export function AssistantDrawer(props: Props) {
  return <AssistantDrawerForOrg key={props.org} {...props} />;
}

function AssistantDrawerForOrg({ open, onClose, org, project, projectName }: Props) {
  const location = useLocation();
  const qc = useQueryClient();

  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamStatus, setStreamStatus] = useState("");
  const [interruptedText, setInterruptedText] = useState("");
  const [requestsInFlight, setRequestsInFlight] = useState(0);
  const activity = useSyncExternalStore(
    subscribeActivity,
    () => orgActivity.get(org) ?? 0,
    () => 0,
  );
  const generation = useRef(0);
  const alive = useRef(true);
  const requestCount = useRef(0);
  const streamAbort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const threadsQ = useQuery({
    queryKey: ["assistant-threads", org],
    queryFn: () => listAssistantThreads(org),
    enabled: Boolean(org) && open,
  });
  const threads = threadsQ.data ?? [];

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      streamAbort.current?.abort();
    };
  }, []);

  const startRequest = (send = false) => {
    requestCount.current += 1;
    setRequestsInFlight(requestCount.current);
    if (send) {
      changeOrgActivity(org, 2);
    }
  };

  const finishRequest = (send = false) => {
    requestCount.current -= 1;
    if (send) changeOrgActivity(org, -2);
    if (alive.current) {
      setRequestsInFlight(requestCount.current);
    }
  };

  const newConversation = () => {
    generation.current += 1;
    streamAbort.current?.abort();
    setThreadId(undefined);
    setSessionId(undefined);
    setMessages([]);
    setInput("");
    setPending(false);
    setLoadingThread(false);
    setShowHistory(false);
    setStreamText("");
    setStreamStatus("");
    setInterruptedText("");
    setError(null);
  };

  const ctx = useMemo(
    () => parseRouteContext(location.pathname, project, projectName),
    [location.pathname, project, projectName],
  );
  const starters = useMemo(() => starterPrompts(ctx), [ctx]);

  const openThread = async (id: string) => {
    if ((orgActivity.get(org) ?? 0) > 0) return;
    const current = ++generation.current;
    setError(null);
    setPending(false);
    setInterruptedText("");
    setLoadingThread(true);
    startRequest();
    try {
      const detail = await getAssistantThread(org, id);
      if (!alive.current || generation.current !== current) return;
      setThreadId(detail.id);
      setSessionId(detail.sessionId || undefined);
      setMessages(detail.messages);
      setInput("");
      setShowHistory(false);
    } catch (e) {
      if (alive.current && generation.current === current) {
        setError(e instanceof Error ? e.message : "Couldn't load thread.");
      }
    } finally {
      finishRequest();
      if (alive.current && generation.current === current) setLoadingThread(false);
    }
  };

  const submitPrompt = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || requestCount.current || (orgActivity.get(org) ?? 0) > 0) return;
    const current = generation.current;
    setError(null);
    setShowHistory(false);
    setInterruptedText("");
    setStreamText("");
    setStreamStatus("Inspecting telemetry…");
    const controller = new AbortController();
    streamAbort.current = controller;
    let partial = "";

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput((draft) => draft.trim() === text ? "" : draft);
    setPending(true);
    startRequest(true);

    try {
      const res = await sendAssistantChat(org, {
        messages: nextMessages,
        threadId,
        sessionId,
        context: ctx,
      }, {
        signal: controller.signal,
        onStatus: (status) => {
          if (alive.current && generation.current === current) setStreamStatus(status);
        },
        onText: (chunk) => {
          partial += chunk;
          if (alive.current && generation.current === current) setStreamText(partial);
        },
        onReset: () => {
          partial = "";
          if (alive.current && generation.current === current) setStreamText("");
        },
      });
      if (!alive.current || generation.current !== current) return;
      setThreadId(res.threadId);
      setSessionId(res.sessionId);
      setMessages([...nextMessages, { role: "assistant", content: res.reply }]);
    } catch (e) {
      if (alive.current && generation.current === current) {
        setMessages(messages);
        setInterruptedText(partial);
        setInput((draft) => draft ? `${text}\n\n${draft}` : text);
        const reason = e instanceof Error ? e.message : "Could not reach assistant.";
        setError(`${reason} The response was interrupted. You can retry your message.`);
      }
    } finally {
      if (streamAbort.current === controller) streamAbort.current = null;
      finishRequest(true);
      void qc.invalidateQueries({ queryKey: ["assistant-threads", org] });
      if (alive.current && generation.current === current) {
        setPending(false);
        setStreamText("");
        setStreamStatus("");
      }
    }
  };

  const removeHistory = async (id?: string) => {
    if (requestCount.current || (orgActivity.get(org) ?? 0) > 0) return;
    changeOrgActivity(org, 1);
    setError(null);
    const current = generation.current;
    try {
      if (id) {
        await deleteAssistantThread(org, id);
      } else {
        await clearAssistantThreads(org);
      }
      if (alive.current && generation.current === current && (!id || id === threadId)) {
        newConversation();
      }
      void qc.invalidateQueries({ queryKey: ["assistant-threads", org] });
    } catch (e) {
      if (alive.current && generation.current === current) {
        setError(e instanceof Error ? e.message : "Couldn't delete history.");
      }
    } finally {
      changeOrgActivity(org, -1);
    }
  };

  useEffect(() => {
    return subscribeAssistantOpen((prompt) => {
      if (prompt) {
        void submitPrompt(prompt);
      }
    });
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, streamText, streamStatus, interruptedText]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt(input);
    }
  };

  const contextLabel = ctx.issueId
    ? `Issue #${ctx.issueId}`
    : ctx.transactionId
      ? `Transaction #${ctx.transactionId}`
      : ctx.monitorId
        ? `Monitor #${ctx.monitorId}`
        : null;

  return (
    <aside className="ai-drawer" aria-label="Hawkeye Assistant">
      <div className="ai-head">
        <div>
          <div className="ai-title-row">
            <h2>Assistant</h2>
            <span className="tag">{project ? projectName : "All projects"}</span>
          </div>
          <p className="ai-sub">
            {org}
            {contextLabel ? ` · ${contextLabel}` : ""}
          </p>
        </div>
        <div className="ai-hacts">
          {threads.length > 0 && (
            <button
              className={`btn ${showHistory ? "ai-on" : ""}`}
              onClick={() => setShowHistory((h) => !h)}
            >
              History ({threads.length})
            </button>
          )}
          {(messages.length > 0 || threadId || loadingThread || pending) && (
            <button
              className="btn"
              onClick={newConversation}
            >
              New
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close assistant">
            Esc
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="ai-msgs">
          <div className="ai-hist-head">
            <span className="eyebrow">Recent threads</span>
            <button
              className="link-btn"
              disabled={requestsInFlight > 0 || activity > 0}
              onClick={() => void removeHistory()}
            >
              Clear all
            </button>
          </div>
          <div className="ai-hist">
            {threads.map((t) => (
              <div key={t.id} className={`ai-hrow ${t.id === threadId ? "on" : ""}`}>
                <button
                  className="ai-hpick"
                  disabled={activity > 0}
                  onClick={() => void openThread(t.id)}
                >
                  <span className="ai-htitle">{t.title}</span>
                  <span className="ai-hmeta">
                    {t.projectName} · {t.messageCount} msgs · {timeAgo(t.updatedAt)}
                  </span>
                </button>
                <button
                  className="ai-hdel"
                  aria-label={`Delete thread ${t.title}`}
                  disabled={requestsInFlight > 0 || activity > 0}
                  onClick={() => void removeHistory(t.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="ai-msgs">
        {messages.length === 0 ? (
          <div className="ai-empty">
            <p className="ai-lead">
              Ask about errors, stack traces, slow queries, logs, or uptime. Responses inspect live telemetry in{" "}
              <strong>{project ? projectName : org}</strong>.
            </p>
            <div className="ai-starters">
              {starters.map((s) => (
                <button key={s} className="ai-starter" onClick={() => void submitPrompt(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`ai-msg ${m.role}`}>
              <div className="ai-role">{m.role === "user" ? "You" : "Hawkeye"}</div>
              {m.role === "user" ? <p className="ai-u">{m.content}</p> : <RichText text={m.content} />}
            </div>
          ))
        )}

        {(pending || interruptedText) && (
          <div className="ai-msg assistant">
            <div className="ai-role">Hawkeye{!pending ? " · Interrupted" : ""}</div>
            {(pending ? streamText : interruptedText) && <RichText text={pending ? streamText : interruptedText} />}
            {pending && (
              <div className="ai-thinking" role="status">
                <span className="ai-pulse" />
                {streamStatus}
              </div>
            )}
          </div>
        )}

        <div ref={endRef} />
        </div>
      )}
      {error && (
        <div className="err-box" role="alert">
          {error}
        </div>
      )}

      <form
        className="ai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void submitPrompt(input);
        }}
      >
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Ask about ${project ? projectName : org}… (Enter to send)`}
          aria-label="Ask Hawkeye Assistant"
          disabled={pending || loadingThread || (activity % 2 === 1)}
        />
        <span className="hint">Telemetry scrubbing is best-effort and may not remove all sensitive content.</span>
        <div className="ai-cfoot">
          <span className="hint">Shift+Enter for newline · ⌘J to toggle</span>
          <button type="submit" className="btn pri" disabled={requestsInFlight > 0 || activity > 0 || !input.trim()}>
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
