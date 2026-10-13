import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useAuth } from "./lib/auth";
import { useOrganizations } from "./lib/queries";
import { ComingSoon } from "./pages/ComingSoon";
import { IssueDetail } from "./pages/IssueDetail";
import { Issues } from "./pages/Issues";
import { AcceptInvite } from "./pages/AcceptInvite";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { ResetPassword } from "./pages/ResetPassword";
import { Signup } from "./pages/Signup";
import { MonitorDetail } from "./pages/MonitorDetail";
import { Performance } from "./pages/Performance";
import { TransactionDetail } from "./pages/TransactionDetail";
import { Uptime } from "./pages/Uptime";
import { General } from "./pages/settings/General";
import { Members } from "./pages/settings/Members";
import { Teams } from "./pages/settings/Teams";
import { ProjectSettings } from "./pages/settings/ProjectSettings";
import { Projects } from "./pages/settings/Projects";
import { SettingsLayout } from "./pages/settings/SettingsLayout";

function Splash({ children = "Loading…" }: { children?: string }) {
  return <div className="splash">{children}</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Splash />;
  if (status === "anon") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

function Home() {
  const orgs = useOrganizations();
  if (orgs.isLoading) return <Splash />;
  const first = orgs.data?.[0];
  if (!first) return <Onboarding />;
  return <Navigate to={`/${first.slug}/issues`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
      <Route path="/reset-password/set-new-password/:key" element={<ResetPassword />} />
      <Route path="/accept/:id/:token" element={<AcceptInvite />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/:org"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="issues" replace />} />
        <Route path="issues" element={<Issues />} />
        <Route path="issues/:id" element={<IssueDetail />} />
        <Route path="uptime" element={<Uptime />} />
        <Route path="uptime/:id" element={<MonitorDetail />} />
        <Route path="performance" element={<Performance />} />
        <Route path="performance/:id" element={<TransactionDetail />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="general" replace />} />
          <Route path="general" element={<General />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:slug" element={<ProjectSettings />} />
          <Route path="members" element={<Members />} />
          <Route path="teams" element={<Teams />} />
        </Route>
        <Route path=":section" element={<ComingSoon />} />
      </Route>
    </Routes>
  );
}
