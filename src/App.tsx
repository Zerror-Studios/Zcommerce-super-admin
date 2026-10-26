import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { RequireAuth, SessionLoading, SessionUnreachable } from "./components/auth/RequireAuth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Spinner } from "./components/ui";
import { useAuth } from "./providers/AuthProvider";

// Review C-L11: each page is its own chunk, so the sign-in screen doesn't
// ship recharts and the store pages. The pages use named exports.
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Ai = lazy(() => import("./pages/Ai").then((m) => ({ default: m.Ai })));
const AddClient = lazy(() => import("./pages/AddClient").then((m) => ({ default: m.AddClient })));
const Billing = lazy(() => import("./pages/Billing").then((m) => ({ default: m.Billing })));
const ClientDetail = lazy(() => import("./pages/ClientDetail").then((m) => ({ default: m.ClientDetail })));
const Clients = lazy(() => import("./pages/Clients").then((m) => ({ default: m.Clients })));
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Mfa = lazy(() => import("./pages/Mfa").then((m) => ({ default: m.Mfa })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword").then((m) => ({ default: m.ForgotPassword })));
const SetPassword = lazy(() => import("./pages/SetPassword").then((m) => ({ default: m.SetPassword })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const SignIn = lazy(() => import("./pages/SignIn").then((m) => ({ default: m.SignIn })));
const DevUiPage = lazy(() => import("./components/ui/DevUiPage"));

/** Inside the shell while a page chunk loads: the same spinner as the session restore. */
function PageLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status">
      <Spinner size="lg" aria-label="Loading" />
    </div>
  );
}

function LegacyStoreRedirect() {
  const { id } = useParams();
  return <Navigate to={`/stores/${id ?? ""}`} replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <SessionLoading />;
  if (status === "unreachable") return <SessionUnreachable />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route
        path="/sign-in"
        element={
          <GuestOnly>
            <SignIn />
          </GuestOnly>
        }
      />
      {/* PRD-014 FR-1.10: request a reset link by email; the link opens /set-password. */}
      <Route
        path="/forgot-password"
        element={
          <GuestOnly>
            <ForgotPassword />
          </GuestOnly>
        }
      />
      {/* Invite and reset links (PRD-005 FR-1.5): the token is the credential, so no session is needed. */}
      <Route path="/set-password" element={<SetPassword />} />

      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Home />} />
          <Route path="stores" element={<Clients />} />
          <Route path="stores/new" element={<AddClient />} />
          <Route path="stores/:id" element={<ClientDetail />} />
          {/* Old "clients" URLs (before the Stores rename) keep working. */}
          <Route path="clients" element={<Navigate to="/stores" replace />} />
          <Route path="clients/new" element={<Navigate to="/stores/new" replace />} />
          <Route path="clients/:id" element={<LegacyStoreRedirect />} />

          <Route path="billing" element={<Navigate to="/billing/subscriptions" replace />} />
          <Route path="billing/:section" element={<Billing />} />

          <Route path="analytics" element={<Navigate to="/analytics/revenue" replace />} />
          <Route path="analytics/:section" element={<Analytics />} />

          {/* PRD-021 FR-6: ZCOM AI usage, top-ups, data health, benchmarks and settings. */}
          <Route path="ai" element={<Navigate to="/ai/overview" replace />} />
          <Route path="ai/:section" element={<Ai />} />

          <Route path="settings" element={<Settings />} />
          {/* Payment reminders moved from Settings to Subscriptions. */}
          <Route path="settings/automation" element={<Navigate to="/billing/reminders" replace />} />
          <Route path="settings/:section" element={<Settings />} />

          {/* MFA enrolment (PRD-005 FR-1.4). */}
          <Route path="mfa" element={<Mfa />} />

          {/* Hidden component showcase (restyle Phase 2); renders only in development builds. */}
          <Route path="dev/ui" element={<DevUiPage />} />

          {/* Unknown URLs show the 404 inside the app shell (signed-out users go to sign-in first). */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}
