import { useNavigate } from "react-router-dom";
import { ErrorState } from "../components/ui";
import { emptyStates } from "../copy";

/**
 * 404 inside the app shell, as the v2 error state (docs/design-v2/README.md §10A): what happened in plain words,
 * what to do next, one button. Red only on the icon tile. The ⌘K search in the menu stays the way to find a page.
 */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        title={emptyStates.notFound.title}
        description={emptyStates.notFound.description}
        retryLabel={emptyStates.notFound.action}
        onRetry={() => navigate("/")}
      />
    </div>
  );
}
