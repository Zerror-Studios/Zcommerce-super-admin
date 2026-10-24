import { Button as UiButton } from "../ui";
import { emptyStates } from "../../copy";

export interface FilterEmptyProps {
  /** Plural noun: "stores" → "No stores match these filters". */
  things: string;
  /** The search text, when the search (not only a filter) emptied the table: "No results for "aura"". */
  query?: string;
  onClear: () => void;
}

/**
 * Empty because of a search or filter (docs/design/09-settings-and-scale.md §3.2): one small inline line with
 * "Clear filters", no icon. Truly empty tables use the kit EmptyState instead.
 */
export function FilterEmpty({ things, query, onClear }: FilterEmptyProps) {
  const copy = query?.trim() ? emptyStates.noResults(query.trim()) : emptyStates.filtered(things);
  return (
    <p className="py-8 text-center text-body text-fg-muted">
      {copy.title} ·{" "}
      <UiButton variant="link" size="sm" onPress={onClear}>
        {copy.action}
      </UiButton>
    </p>
  );
}
