import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "../lib/account";
import { getAssistantSettings, subscribeAssistantOpen } from "../lib/assistant";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/format";
import { useOrganizations, useProjects, useSettings } from "../lib/queries";
import { useTheme } from "../lib/theme";
import { AssistantDrawer } from "./AssistantDrawer";
import { SearchIcon } from "./Icons";
import { Logo } from "./Logo";

const DOCS = "https://github.com/Dominic62q/HawkeyeFrontendMain#readme";
const BUG_REPORTS ="https://github.com/Dominic62q/HawkeyeFrontendMain/issues";

const TABS = [
  ["issues", "Issues"],
  ["uptime", "Uptime"],
  ["performance", "Performance"],
  ["logs", "Logs"],
  ["settings", "Settings"],
] as const;

export function Shell() {
  const { org = "" } = useParams();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const orgs = useOrganizations();
  const projects = useProjects(org);
  const features = useSettings().data?.enabledFeatures;
  const isOperator = useUser().data?.isSuperuser === true;
  const assistantCfg = useQuery({
    queryKey: ["assistant-settings", org],
    queryFn: () => getAssistantSettings(org),
    enabled: Boolean(org),
  });
  const assistantEnabled = assistantCfg.data?.enabled !== false;
  const [menu, setMenu] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen((v) => !v);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const unsub = subscribeAssistantOpen(() => setAssistantOpen(true));
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      unsub();
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
    // Stay on the active section list when switching projects; detail/settings pages land on Issues.
    const section = TABS.slice(0, 4).find(([slug]) => location.pathname === `/${org}/${slug}`)?.[0] ?? "issues";
    const qs = next.toString();
    navigate(`/${org}/${section}${qs ? `?${qs}` : ""}`);
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
          <select
            aria-label="Project"
            className={project ? "scoped" : undefined}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">all projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <form className="cmd" onSubmit={search} role="search">
          <SearchIcon />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search issues"
          />
          <kbd>⌘K</kbd>
        </form>
        <div className="sp" />
        {assistantEnabled && (
          <button
            className={`ai-trigger ${assistantOpen ? "on" : ""}`}
            onClick={() => setAssistantOpen((v) => !v)}
            aria-label="Toggle Hawkeye Assistant"
            aria-expanded={assistantOpen}
          >
            <span className="ai-dot" aria-hidden="true" />
            <span>Ask AI</span>
            <kbd>⌘J</kbd>
          </button>
        )}
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
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  navigate(`/${org}/account/profile`);
                }}
              >
                Account
              </button>
              {isOperator && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    navigate("/operator");
                  }}
                >
                  Operator console
                </button>
              )}
              <a
                role="menuitem"
                href={DOCS}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(false)}
              >
                Documentation
              </a>
              <a
                role="menuitem"
                href={BUG_REPORTS}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(false)}
              >
                Report a bug
              </a>
              <button role="menuitem" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        {/* Logs and Uptime only exist when the server has them switched on. */}
        {TABS.filter(([slug]) => !(slug === "logs" || slug === "uptime") || !features || features.includes(slug)).map(([slug, label]) => {
          const qs = project ? `?project=${encodeURIComponent(project)}` : "";
          return (
            <NavLink key={slug} to={`/${org}/${slug}${qs}`} className={({ isActive }) => (isActive ? "on" : "")}>
              {label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
      {assistantEnabled && (
        <AssistantDrawer
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          org={org}
          project={project}
          projectName={projects.data?.find((p) => p.id === project)?.name ?? "All projects"}
        />
      )}
    </>
  );
}
