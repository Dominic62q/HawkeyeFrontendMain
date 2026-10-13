import { NavLink, Outlet, useParams } from "react-router-dom";

const ITEMS = [
  { to: "general", label: "General" },
  { to: "projects", label: "Projects" },
  { to: "members", label: "Members" },
  { to: "teams", label: "Teams" },
];

export function SettingsLayout() {
  const { org = "" } = useParams();
  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <h1>Settings</h1>
          <p className="psub">{org}</p>
        </div>
      </div>
      <div className="sgrid">
        <nav className="srail" aria-label="Settings sections">
          {ITEMS.map((i) => (
            <NavLink key={i.to} to={`/${org}/settings/${i.to}`} className={({ isActive }) => (isActive ? "on" : "")}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="spane">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
