import { useEffect, useState } from "react";
import { timeAgo } from "../../lib/format";
import { useOperatorUsers, useSetUserActive, type UserRow } from "./api";
import { ConfirmAction, LoadError, Loading, Pager, useDebounced } from "./parts";

function UserControl({ u }: { u: UserRow }) {
  const setActive = useSetUserActive(u.id);
  const who = u.name || u.email;
  // Superusers are deactivated in Django admin, after their flag is removed.
  if (u.isSuperuser && u.isActive) return null;
  return u.isActive ? (
    <ConfirmAction
      danger
      label="Deactivate"
      title={`Deactivate ${who}?`}
      text={`${who} will be signed out and won't be able to sign in. Their API tokens stop working. Their organizations and data stay as they are.`}
      confirmLabel="Deactivate"
      value={false}
      mutation={setActive}
    />
  ) : (
    <ConfirmAction
      label="Reactivate"
      title={`Reactivate ${who}?`}
      text={`${who} will be able to sign in again.`}
      confirmLabel="Reactivate"
      value={true}
      mutation={setActive}
    />
  );
}

export function Users() {
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(text.trim());
  const users = useOperatorUsers(q, page);

  useEffect(() => setPage(1), [q]);

  return (
    <>
      <div className="phead">
        <div>
          <h1>Users</h1>
          <p className="psub">Newest first.</p>
        </div>
      </div>
      <div className="toolbar">
        <input
          className="ctl search"
          type="search"
          placeholder="Search email or name"
          aria-label="Search users"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {users.isLoading && <Loading />}
      {users.isError && <LoadError what="users" retry={() => void users.refetch()} />}
      {users.data && (
        <>
          <div className="card op-scroll">
            <table className="op-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th className="r">Organizations</th>
                  <th>Last sign-in</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data.results.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name || u.email}
                      {u.name && <span className="op-sub">{u.email}</span>}
                    </td>
                    <td>
                      <span className="op-tags">
                        {u.isSuperuser && <span className="tag new">Superuser</span>}
                        {!u.isActive && <span className="tag bad">Inactive</span>}
                        {u.isActive && !u.isSuperuser && <span className="tag">Active</span>}
                      </span>
                    </td>
                    <td className="r">{u.organizationCount}</td>
                    <td>{u.lastLogin ? timeAgo(u.lastLogin) : "never"}</td>
                    <td>{timeAgo(u.created)}</td>
                    <td className="r">
                      <UserControl u={u} />
                    </td>
                  </tr>
                ))}
                {users.data.results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="soft">
                      {q ? "No users match that search." : "No users yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager data={users.data} page={page} onPage={setPage} />
        </>
      )}
    </>
  );
}
