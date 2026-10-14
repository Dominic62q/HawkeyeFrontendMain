import { useEffect, useState } from "react";
import type { Page } from "./api";

/** Search box that waits for a pause in typing before it updates the query. */
export function useDebounced(value: string, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function Pager({
  data,
  page,
  onPage,
}: {
  data: Page<unknown> | undefined;
  page: number;
  onPage: (n: number) => void;
}) {
  if (!data || data.count <= data.pageSize) return null;
  const last = Math.ceil(data.count / data.pageSize);
  return (
    <div className="op-pager">
      <span>
        Page {page} of {last} · {data.count.toLocaleString()} total
      </span>
      <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button className="btn sm" disabled={page >= last} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Kpi({
  label,
  value,
  note,
  hot,
}: {
  label: string;
  value: number | string;
  note?: string;
  hot?: boolean;
}) {
  return (
    <div className="card op-kpi">
      <span className="eyebrow">{label}</span>
      <b className={hot ? "hot" : undefined}>{typeof value === "number" ? value.toLocaleString() : value}</b>
      {note && <small>{note}</small>}
    </div>
  );
}

export function Loading() {
  return <div className="skel" style={{ width: "40%", height: 28 }} />;
}

export function LoadError({ what, retry }: { what: string; retry: () => void }) {
  return (
    <div className="err-box" role="alert">
      Couldn't load {what}.<button onClick={retry}>Try again</button>
    </div>
  );
}
