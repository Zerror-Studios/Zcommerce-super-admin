/**
 * A search box whose value lives in the URL (?q=…, docs/design/09-settings-and-scale.md §3.1).
 *
 * The field stays live while typing (spaces included); the URL is written
 * ~300 ms after typing stops, so each pause is one history entry and one
 * server query at most. Clearing the URL elsewhere (Clear filters) clears the
 * field too.
 */

import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useUrlSearch(
  urlValue: string,
  commit: (value: string) => void,
): [string, (value: string) => void] {
  const [value, setValue] = useState(urlValue);
  const debounced = useDebouncedValue(value);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (debounced.trim() !== urlValue) commitRef.current(debounced);
    // Only a new debounced value writes the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setValue((current) => (current.trim() === urlValue ? current : urlValue));
  }, [urlValue]);

  return [value, setValue];
}
