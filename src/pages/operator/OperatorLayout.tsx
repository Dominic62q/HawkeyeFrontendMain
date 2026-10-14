import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { initials } from "../../lib/format";
import { useTheme } from "../../lib/theme";
import { useOverview } from "./api";
import "./operator.css";

const TABS = [
  ["", "Overview"],
  ["organizations", "Organizations"],
  ["users", "Users"],
] as const;

/** Shown to anyone who is not an active superuser. The API enforces it; this is only the message. */
function Denied() {
  return (
    <div className="op-denied">
      <h1>Operator access only</h1>
      <p>This area is for the person who runs this Hawkeye server.</p>
      <p style={{ marginTop: 20 }}>
        <Link className="btn" to="/">
          Back to Hawkeye
        </Link>
      </p>
    </div>
  );
}

export function OperatorLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const overview = useOverview();
  const denied = overview.error instanceof ApiError && overview.error.status === 401;

  return (
    <>
      <header className="bar">
        <Link to="/operator" aria-label="Operator console home">
          <Logo />
        </Link>
        <span className="op-badge">Operator</span>
        <div className="sp" />
        <Link className="op-back" to="/">
          Back to app
        </Link>
        <button className="icon-btn" onClick={toggle} aria-label="Switch theme">
          {theme === "paper" ? "Night" : "Paper"}
        </button>
        <button className="av" onClick={() => void logout()} aria-label="Sign out" title="Sign out">
          {initials(user?.email ?? "")}
        </button>
      </header>
      {denied ? (
        <Denied />
      ) : (
        <>
          <nav className="tabs" aria-label="Operator sections">
            {TABS.map(([path, label]) => (
              <NavLink
                key={path}
                to={`/operator${path ? `/${path}` : ""}`}
                end={path === ""}
                className={({ isActive }) => (isActive ? "on" : "")}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="wrap">
            <Outlet />
          </div>
        </>
      )}
    </>
  );
}
