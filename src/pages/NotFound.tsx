import { useNavigate } from "react-router-dom";
import { Button, EmptyState, IconSearch } from "../components/ui";
import { emptyStates } from "../copy";

/** 404 inside the app shell (docs/design/02-components.md §9): "Page not found", "Go to Home". */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={IconSearch}
        title={emptyStates.notFound.title}
        description={emptyStates.notFound.description}
        action={
          <Button variant="secondary" onPress={() => navigate("/")}>
            {emptyStates.notFound.action}
          </Button>
        }
      />
    </div>
  );
}
