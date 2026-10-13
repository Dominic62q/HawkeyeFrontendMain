import { useLocation, useSearchParams } from "react-router-dom";
import { safeNext } from "./auth";

/** Where to go once the user is signed in: ?next=, else the page they were sent away from, else home. */
export function useNext(): { next: string; withNext: (path: string) => string } {
  const location = useLocation();
  const [params] = useSearchParams();
  const state = location.state as { from?: string } | null;
  const next = state?.from ?? safeNext(params.get("next")) ?? "/";
  return { next, withNext: (path) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`) };
}
