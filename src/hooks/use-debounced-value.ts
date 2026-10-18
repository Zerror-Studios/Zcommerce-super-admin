/**
 * Debounced value for search boxes that feed server queries (review C-M6):
 * the input stays live, the query sees the value ~300 ms after typing stops.
 */

import { useEffect, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 300;

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useDebouncedValue<T>(value: T, delayMs = DEFAULT_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
