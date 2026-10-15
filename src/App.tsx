import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import DevUiPage from "./components/ui/DevUiPage";
import { Analytics } from "./pages/Analytics";
import { AddClient } from "./pages/AddClient";
import { Billing } from "./pages/Billing";
import { ClientDetail } from "./pages/ClientDetail";
import { Clients } from "./pages/Clients";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Settings } from "./pages/Settings";
import { SignIn } from "./pages/SignIn";
import { useAuth } from "./providers/AuthProvider";

function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          <GuestOnly>
            <SignIn />
          </GuestOnly>
        }
      />

      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Home />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/new" element={<AddClient />} />
          <Route path="clients/:id" element={<ClientDetail />} />

          <Route path="billing" element={<Navigate to="/billing/subscriptions" replace />} />
          <Route path="billing/:section" element={<Billing />} />

          <Route path="analytics" element={<Navigate to="/analytics/revenue" replace />} />
          <Route path="analytics/:section" element={<Analytics />} />

          <Route path="settings" element={<Navigate to="/settings/discounts" replace />} />
          <Route path="settings/:section" element={<Settings />} />

          {/* Hidden component showcase (restyle Phase 2); renders only in development builds. */}
          <Route path="dev/ui" element={<DevUiPage />} />

          {/* Unknown URLs show the 404 inside the app shell (signed-out users go to sign-in first). */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
