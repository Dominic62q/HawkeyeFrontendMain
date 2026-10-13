const UNITS: [number, string][] = [
  [60, "s"],
  [60, "m"],
  [24, "h"],
  [7, "d"],
  [4.345, "w"],
  [12, "mo"],
  [Infinity, "y"],
];

export function timeAgo(iso: string, now = Date.now()): string {
  let diff = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (diff < 45) return "just now";
  for (const [size, unit] of UNITS) {
    if (diff < size) return `${Math.max(1, Math.floor(diff))}${unit} ago`;
    diff /= size;
  }
  return "";
}

export function compact(n: number | string): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(n),
  );
}

/** Normalise a stats timestamp (seconds or milliseconds) to milliseconds. */
export function toMs(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

export function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}
