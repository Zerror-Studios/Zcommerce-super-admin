import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import { ErrorState, Spinner } from "../ui";

/** Full-page wait while the session is restored from the refresh cookie. */
export function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken" role="status">
      <Spinner size="lg" aria-label="Loading" />
    </div>
  );
}

/** The refresh call failed for a network or server reason: offer Retry, not the sign-in form (review C-L2). */
export function SessionUnreachable() {
  const { retryRestore } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken">
      <ErrorState
        title="Can't reach the server."
        description="Check your connection and try again. You haven't been signed out."
        onRetry={() => void retryRestore()}
      />
    </div>
  );
}

export function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") return <SessionLoading />;
  if (status === "unreachable") return <SessionUnreachable />;
  if (status !== "authenticated") {
    return <Navigate to="/sign-in" replace />;
  }
  return <Outlet />;
}
