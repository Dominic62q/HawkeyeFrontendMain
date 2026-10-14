import { Link, useParams } from "react-router-dom";
import { timeAgo } from "../../lib/format";
import { useOperatorOrg } from "./api";
import { OrgStatus } from "./Organizations";
import { Kpi, LoadError, Loading } from "./parts";

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "";
}

export function OrganizationDetail() {
  const { id = "" } = useParams();
  const q = useOperatorOrg(id);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <LoadError what="this organization" retry={() => void q.refetch()} />;
  const o = q.data;
  const period = o.periodStart && o.periodEnd ? `${when(o.periodStart)} to ${when(o.periodEnd)}` : "current period";

  return (
    <>
      <p className="psub" style={{ marginBottom: 8 }}>
        <Link className="op-back" to="/operator/organizations">
          ← Organizations
        </Link>
      </p>
      <div className="phead">
        <div>
          <h1>{o.name}</h1>
          <p className="psub">
            <span className="mono">{o.slug}</span> · created {timeAgo(o.created)}
          </p>
        </div>
        <OrgStatus o={o} />
      </div>

      <h2 className="op-section" style={{ marginTop: 8 }}>
        Usage
      </h2>
      <p className="psub" style={{ marginBottom: 12 }}>
        {period}
      </p>
      <div className="op-kpis">
        <Kpi label="Error events" value={o.usage.issueEvents} />
        <Kpi label="Transactions" value={o.usage.transactions} />
        <Kpi label="Logs" value={o.usage.logs} />
        <Kpi label="Uptime checks" value={o.usage.uptimeChecks} />
      </div>
      <div className="card">
        <dl className="op-dl">
          <dt>Billed total</dt>
          <dd>{o.usage.billedTotal.toLocaleString()}</dd>
          <dt>Stored files</dt>
          <dd>{o.usage.fileSizeMb.toLocaleString()} MB</dd>
        </dl>
      </div>

      <div className="op-grid">
        <div>
          <h2 className="op-section">Members ({o.members.length})</h2>
          <div className="card op-scroll">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {o.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.name || m.email}
                      {m.name && <span className="op-sub">{m.email}</span>}
                    </td>
                    <td>
                      {m.role} {m.pending && <span className="tag new">Invited</span>}
                    </td>
                    <td>{m.lastLogin ? timeAgo(m.lastLogin) : m.pending ? "" : "never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="op-section">Projects ({o.projects.length})</h2>
          <div className="card op-scroll">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Platform</th>
                  <th>First event</th>
                </tr>
              </thead>
              <tbody>
                {o.projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <span className="op-sub mono">{p.slug}</span>
                    </td>
                    <td>{p.platform || ""}</td>
                    <td>{p.firstEvent ? timeAgo(p.firstEvent) : "none yet"}</td>
                  </tr>
                ))}
                {o.projects.length === 0 && (
                  <tr>
                    <td colSpan={3} className="soft">
                      No projects.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
