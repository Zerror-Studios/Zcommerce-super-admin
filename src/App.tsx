import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { RequireAuth, SessionLoading, SessionUnreachable } from "./components/auth/RequireAuth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { aiSettingsRedirect } from "./components/settings/settings-routes";
import { legacyAiRedirect, legacyBillingRedirect, legacySubscriptionStoreRedirect } from "./lib/legacy-routes.util";
import { Spinner } from "./components/ui";
import { useAuth } from "./providers/AuthProvider";

// Review C-L11: each page is its own chunk, so the sign-in screen doesn't
// ship recharts and the store pages. The pages use named exports.
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Ai = lazy(() => import("./pages/Ai").then((m) => ({ default: m.Ai })));
const AddClient = lazy(() => import("./pages/AddClient").then((m) => ({ default: m.AddClient })));
const ClientDetail = lazy(() => import("./pages/ClientDetail").then((m) => ({ default: m.ClientDetail })));
const Clients = lazy(() => import("./pages/Clients").then((m) => ({ default: m.Clients })));
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Mfa = lazy(() => import("./pages/Mfa").then((m) => ({ default: m.Mfa })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword").then((m) => ({ default: m.ForgotPassword })));
const SetPassword = lazy(() => import("./pages/SetPassword").then((m) => ({ default: m.SetPassword })));
const Subscriptions = lazy(() => import("./pages/Subscriptions").then((m) => ({ default: m.Subscriptions })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const SignIn = lazy(() => import("./pages/SignIn").then((m) => ({ default: m.SignIn })));
// The component showcase ships in development builds only (docs/design/README.md Phase 10).
const DevUiPage = import.meta.env.DEV ? lazy(() => import("./components/ui/DevUiPage")) : null;

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
  return <Navigate to={`/stores/${id ?? ""}/overview`} replace />;
}

/** `/stores/:id` → `/stores/:id/<section>`, keeping the query string and hash. */
function StoreSectionRedirect({ section }: { section: string }) {
  const { id } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`/stores/${id ?? ""}/${section}${search}${hash}`} replace />;
}

/** `/ai/settings?section=spend` → `/settings/ai#spend` (04 S-00). */
function LegacyAiSettingsRedirect() {
  const { search } = useLocation();
  return <Navigate to={aiSettingsRedirect(search)} replace />;
}

/** `/billing/*` and `/reminders` → Subscriptions with the matching tab, filter and period (04 S-00). */
function LegacyBillingRedirect({ section }: { section?: string }) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={legacyBillingRedirect(section ?? params.section, search)} replace />;
}

/** `/ai/overview`, `/ai/usage?view=…` → `/ai?tab=…` (04 S-00). */
function LegacyAiRedirect() {
  const { section } = useParams();
  const { search } = useLocation();
  return <Navigate to={legacyAiRedirect(section, search)} replace />;
}

/** `/subscriptions?store=:id` opens that store's Billing & plan (04 S-04a: no side panel any more). */
function SubscriptionsRoute() {
  const { search } = useLocation();
  const store = legacySubscriptionStoreRedirect(search);
  return store ? <Navigate to={store} replace /> : <Subscriptions />;
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
          {/* 04 S-00: /stores/:id opens Overview; the Subscription section merged into Billing & plan. */}
          <Route path="stores/:id" element={<StoreSectionRedirect section="overview" />} />
          <Route path="stores/:id/subscription" element={<StoreSectionRedirect section="billing" />} />
          <Route path="stores/:id/:section" element={<ClientDetail />} />
          {/* Old "clients" URLs (before the Stores rename) keep working. */}
          <Route path="clients" element={<Navigate to="/stores" replace />} />
          <Route path="clients/new" element={<Navigate to="/stores/new" replace />} />
          <Route path="clients/:id" element={<LegacyStoreRedirect />} />

          {/* 04 S-04: one Subscriptions page; Collections, Invoices, Transactions and Payment reminders redirect. */}
          <Route path="subscriptions" element={<SubscriptionsRoute />} />
          <Route path="billing" element={<LegacyBillingRedirect />} />
          <Route path="billing/:section" element={<LegacyBillingRedirect />} />
          <Route path="reminders" element={<LegacyBillingRedirect section="reminders" />} />

          <Route path="analytics" element={<Navigate to="/analytics/revenue" replace />} />
          <Route path="analytics/:section" element={<Analytics />} />

          {/* PRD-021 FR-6: ZCOM AI usage, top-ups, data health, benchmarks and settings. */}
          {/* 04 S-06: one page with tabs (?tab=…); /ai/overview and /ai/usage redirect. */}
          <Route path="ai" element={<Ai />} />
          {/* AI settings moved to Settings › ZCOM AI settings (04 S-06 change 2): ?section=x → #x. */}
          <Route path="ai/settings" element={<LegacyAiSettingsRedirect />} />
          <Route path="ai/:section" element={<LegacyAiRedirect />} />

          <Route path="settings" element={<Settings />} />
          {/* Payment reminders moved from Settings to its own page. */}
          <Route path="settings/automation" element={<Navigate to="/reminders" replace />} />
          <Route path="settings/:section" element={<Settings />} />

          {/* MFA enrolment (PRD-005 FR-1.4). */}
          <Route path="mfa" element={<Mfa />} />

          {/* Hidden component showcase (restyle Phase 2); renders only in development builds. */}
          {DevUiPage ? <Route path="dev/ui" element={<DevUiPage />} /> : null}

          {/* Unknown URLs show the 404 inside the app shell (signed-out users go to sign-in first). */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}
