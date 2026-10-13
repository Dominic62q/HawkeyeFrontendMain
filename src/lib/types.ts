export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
}

export interface Environment {
  id: number;
  name: string;
}

export type IssueStatus = "unresolved" | "resolved" | "ignored";

export interface Issue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: string;
  status: IssueStatus;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  metadata: { type?: string; value?: string; filename?: string; function?: string };
  project: { id: string; slug: string; name: string };
  stats: Record<string, [number, number][]>;
  firstRelease?: { version: string } | null;
  lastRelease?: { version: string } | null;
  logger?: string | null;
  assignedTo?: unknown;
}

export interface StackFrame {
  filename?: string;
  absPath?: string;
  function?: string;
  module?: string;
  lineNo?: number;
  context_line?: string;
  context?: [number, string][];
  inApp?: boolean;
}

export interface ExceptionValue {
  type?: string;
  value?: string;
  stacktrace?: { frames?: StackFrame[] } | null;
}

export interface Breadcrumb {
  timestamp?: string;
  category?: string;
  message?: string;
  level?: string;
  type?: string;
}

export type EventEntry =
  | { type: "exception"; data: { values: ExceptionValue[] } }
  | { type: "breadcrumbs"; data: { values: Breadcrumb[] } }
  | { type: string; data: unknown };

export interface EventUser {
  id?: string | null;
  email?: string | null;
  username?: string | null;
  ip_address?: string | null;
}

export interface IssueEvent {
  id: string;
  eventID: string;
  dateCreated: string;
  platform?: string | null;
  message?: string;
  culprit?: string;
  tags: { key: string; value: string }[];
  entries: EventEntry[];
  user?: EventUser | null;
  previousEventID?: string | null;
  nextEventID?: string | null;
}
