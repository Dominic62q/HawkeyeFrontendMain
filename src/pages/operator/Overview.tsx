import { compact } from "../../lib/format";
import { useOverview } from "./api";
import { Kpi, LoadError, Loading } from "./parts";

const USAGE_ROWS = [
  ["issueEvents", "Error events"],
  ["transactions", "Transactions"],
  ["logs", "Logs"],
  ["uptimeChecks", "Uptime checks"],
] as const;

export function Overview() {
  const q = useOverview();
  if (q.isLoading) return <Loading />;
  if (!q.data) return <LoadError what="the overview" retry={() => void q.refetch()} />;
  const { organizations: o, users: u, usage, usageWindowDays: days } = q.data;

  return (
    <>
      <div className="phead">
        <div>
          <h1>Overview</h1>
          <p className="psub">Counts and usage only. Customer event content is never shown here.</p>
        </div>
      </div>

      <div className="op-kpis">
        <Kpi label="Organizations" value={o.total} note={`${o.new} new in ${days} days`} />
        <Kpi label="Users" value={u.total} note={`${u.recent} signed in within ${days} days`} />
        <Kpi label="Projects" value={q.data.projects} />
        <Kpi
          label="Not accepting events"
          value={o.paused}
          hot={o.paused > 0}
          note={o.throttled ? `${o.throttled} throttled` : "none throttled"}
        />
      </div>

      <h2 className="op-section">Ingest volume</h2>
      <div className="card op-scroll">
        <table className="op-table">
          <thead>
            <tr>
              <th>Type</th>
              <th className="r">Last 24 hours</th>
              <th className="r">Last {days} days</th>
            </tr>
          </thead>
          <tbody>
            {USAGE_ROWS.map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                <td className="r" title={usage[key].last24Hours.toLocaleString()}>
                  {compact(usage[key].last24Hours)}
                </td>
                <td className="r" title={usage[key].last30Days.toLocaleString()}>
                  {compact(usage[key].last30Days)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="op-section">Accounts</h2>
      <div className="card">
        <dl className="op-dl">
          <dt>Active organizations</dt>
          <dd>
            {o.active.toLocaleString()} of {o.total.toLocaleString()}
          </dd>
          <dt>Active users</dt>
          <dd>
            {u.active.toLocaleString()} of {u.total.toLocaleString()}
          </dd>
          <dt>Superusers</dt>
          <dd>{u.superusers.toLocaleString()}</dd>
          <dt>New users</dt>
          <dd>
            {u.new.toLocaleString()} in the last {days} days
          </dd>
        </dl>
      </div>
    </>
  );
}
