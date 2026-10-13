import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/format";
import { useOrganizations, useProjects } from "../lib/queries";
import { useTheme } from "../lib/theme";
import { Logo } from "./Logo";

const TABS = [
  ["issues", "Issues"],
  ["uptime", "Uptime"],
  ["performance", "Performance"],
  ["logs", "Logs"],
  ["releases", "Releases"],
  ["settings", "Settings"],
] as const;

export function Shell() {
  const { org = "" } = useParams();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orgs = useOrganizations();
  const projects = useProjects(org);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, []);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    navigate(`/${org}/issues?${next}`);
  };

  const project = params.get("project") ?? "";
  const setProject = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("project", id);
    else next.delete("project");
    navigate(`/${org}/issues?${next}`);
  };

  return (
    <>
      <header className="bar">
        <Link to={`/${org}/issues`} aria-label="Hawkeye home">
          <Logo />
        </Link>
        <div className="scope">
          <select
            aria-label="Organization"
            value={org}
            onChange={(e) => navigate(`/${e.target.value}/issues`)}
          >
            {(orgs.data ?? [{ id: "x", name: org, slug: org }]).map((o) => (
              <option key={o.id} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
          /
          <select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">all projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <form className="cmd" onSubmit={search} role="search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search issues"
            aria-label="Search issues"
          />
          <kbd>⌘K</kbd>
        </form>
        <div className="sp" />
        <button className="icon-btn" onClick={toggle} aria-label="Switch theme">
          {theme === "paper" ? "Night" : "Paper"}
        </button>
        <div className="menu" ref={menuRef}>
          <button
            className="av"
            onClick={() => setMenu((m) => !m)}
            aria-label="Account menu"
            aria-expanded={menu}
          >
            {initials(user?.email ?? "")}
          </button>
          {menu && (
            <div className="menu-pop" role="menu">
              <div className="who">{user?.email}</div>
              <button role="menuitem" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        {TABS.map(([slug, label]) => (
          <NavLink key={slug} to={`/${org}/${slug}`} className={({ isActive }) => (isActive ? "on" : "")}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
