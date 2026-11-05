/**
 * The summary panel's collapse key (design v2 §4.2, §9): remembered per user,
 * per page. The kit's `SummaryPanel` stores the choice under the key it is
 * given; this namespaces the page by the signed-in platform user.
 */
import { useAuth } from "../providers/AuthProvider";

export function useSummaryKey(page: string): string {
  const { user } = useAuth();
  return `${user?.id ?? "me"}:${page}`;
}
