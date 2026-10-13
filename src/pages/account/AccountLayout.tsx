import { NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";

const ITEMS = [
  { to: "profile", label: "Profile" },
  { to: "emails", label: "Email addresses" },
  { to: "security", label: "Security" },
  { to: "tokens", label: "API tokens" },
];

export function AccountLayout() {
  const { org = "" } = useParams();
  const { user } = useAuth();
  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <h1>Account</h1>
          <p className="psub">{user?.email}</p>
        </div>
      </div>
      <div className="sgrid">
        <nav className="srail" aria-label="Account sections">
          {ITEMS.map((i) => (
            <NavLink key={i.to} to={`/${org}/account/${i.to}`} className={({ isActive }) => (isActive ? "on" : "")}>
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
