import { useNavigate } from "react-router-dom";
import { Button, EmptyState, IconSearch } from "../components/ui";

/** 404 inside the app shell (docs/design/02-components.md §9): "Page not found", "Go to Home". */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={IconSearch}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Button variant="secondary" onPress={() => navigate("/")}>
            Go to Home
          </Button>
        }
      />
    </div>
  );
}
