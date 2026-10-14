import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useAuth } from "./lib/auth";
import { useOrganizations } from "./lib/queries";
import { IssueDetail } from "./pages/IssueDetail";
import { Issues } from "./pages/Issues";
import { Logs } from "./pages/Logs";
import { AcceptInvite } from "./pages/AcceptInvite";
import { ConfirmEmail } from "./pages/ConfirmEmail";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { ResetPassword } from "./pages/ResetPassword";
import { Signup } from "./pages/Signup";
import { MonitorDetail } from "./pages/MonitorDetail";
import { Performance } from "./pages/Performance";
import { TransactionDetail } from "./pages/TransactionDetail";
import { Uptime } from "./pages/Uptime";
import { AccountLayout } from "./pages/account/AccountLayout";
import { Emails } from "./pages/account/Emails";
import { Profile } from "./pages/account/Profile";
import { Security } from "./pages/account/Security";
import { Tokens } from "./pages/account/Tokens";
import { General } from "./pages/settings/General";
import { Members } from "./pages/settings/Members";
import { Teams } from "./pages/settings/Teams";
import { ProjectSettings } from "./pages/settings/ProjectSettings";
import { Projects } from "./pages/settings/Projects";
import { SettingsLayout } from "./pages/settings/SettingsLayout";

const OperatorApp = lazy(() => import("./pages/operator/OperatorApp"));

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

/** The classic app's social sign-in landing page; the sign-in form handles it here. */
function FinalizeLogin() {
  const { search } = useLocation();
  return <Navigate to={`/login${search}`} replace />;
}

/** Backend alert and email links use the classic app's `/uptime-monitors/:id`. */
function MonitorRedirect() {
  const { org = "", id = "" } = useParams();
  return <Navigate to={`/${org}/uptime/${id}`} replace />;
}

/** Sentry-style `/:org/:project/issues/:id` links, which the classic app also accepts. */
function SentryIssueRedirect() {
  const { org = "", id = "" } = useParams();
  return <Navigate to={`/${org}/issues/${id}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/login/finalize" element={<FinalizeLogin />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
      <Route path="/reset-password/set-new-password/:key" element={<ResetPassword />} />
      <Route path="/accept/:id/:token" element={<AcceptInvite />} />
      <Route path="/profile/confirm-email/:key" element={<ConfirmEmail />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/operator/*"
        element={
          <RequireAuth>
            <Suspense fallback={<Splash />}>
              <OperatorApp />
            </Suspense>
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
        <Route path=":project/issues/:id" element={<SentryIssueRedirect />} />
        <Route path="uptime" element={<Uptime />} />
        <Route path="uptime/:id" element={<MonitorDetail />} />
        <Route path="uptime-monitors/:id" element={<MonitorRedirect />} />
        <Route path="logs" element={<Logs />} />
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
        <Route path="account" element={<AccountLayout />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="emails" element={<Emails />} />
          <Route path="security" element={<Security />} />
          <Route path="tokens" element={<Tokens />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
