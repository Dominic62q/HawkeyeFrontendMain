import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { compact, timeAgo } from "../../lib/format";
import { useOperatorOrgs, type OrgRow } from "./api";
import { LoadError, Loading, Pager, useDebounced } from "./parts";

export function OrgStatus({ o }: { o: Pick<OrgRow, "isActive" | "isAcceptingEvents" | "eventThrottleRate"> }) {
  return (
    <span className="op-tags">
      {!o.isActive && <span className="tag bad">Inactive</span>}
      {!o.isAcceptingEvents && <span className="tag bad">Not accepting events</span>}
      {o.eventThrottleRate > 0 && <span className="tag warn">Throttled {o.eventThrottleRate}%</span>}
      {o.isActive && o.isAcceptingEvents && o.eventThrottleRate === 0 && <span className="tag ok">Healthy</span>}
    </span>
  );
}

export function Organizations() {
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(text.trim());
  const orgs = useOperatorOrgs(q, page);

  useEffect(() => setPage(1), [q]);

  return (
    <>
      <div className="phead">
        <div>
          <h1>Organizations</h1>
          <p className="psub">Newest first. Usage is the last 30 days.</p>
        </div>
      </div>
      <div className="toolbar">
        <input
          className="ctl search"
          type="search"
          placeholder="Search name or slug"
          aria-label="Search organizations"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {orgs.isLoading && <Loading />}
      {orgs.isError && <LoadError what="organizations" retry={() => void orgs.refetch()} />}
      {orgs.data && (
        <>
          <div className="card op-scroll">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Status</th>
                  <th className="r">Members</th>
                  <th className="r">Projects</th>
                  <th className="r">Events</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.data.results.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="op-link" to={`/operator/organizations/${o.id}`}>
                        {o.name}
                      </Link>
                      <span className="op-sub mono">{o.slug}</span>
                    </td>
                    <td>
                      <OrgStatus o={o} />
                    </td>
                    <td className="r">{o.memberCount}</td>
                    <td className="r">{o.projectCount}</td>
                    <td className="r" title={o.events30Days.toLocaleString()}>
                      {compact(o.events30Days)}
                    </td>
                    <td>{timeAgo(o.created)}</td>
                  </tr>
                ))}
                {orgs.data.results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="soft">
                      {q ? "No organizations match that search." : "No organizations yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager data={orgs.data} page={page} onPage={setPage} />
        </>
      )}
    </>
  );
}
