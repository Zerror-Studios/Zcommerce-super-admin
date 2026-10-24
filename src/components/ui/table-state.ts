/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Table state for lists at scale (docs/design/09-settings-and-scale.md §3.1):
 * - useTableUrlState: page, rows per page, sort, search and filters live in the URL (?page=2&sort=createdAt:desc
 *   &q=kurta&status=paid), so views are shareable and survive refresh. Changing anything but the page goes back
 *   to page 1.
 * - usePersistentColumns: the Columns choice per table, remembered in localStorage.
 */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "./TablePagination";

export type SortDirection = "asc" | "desc";
export interface TableSort {
  column: string;
  direction: SortDirection;
}

export interface TableUrlState {
  page: number;
  pageSize: number;
  sort?: TableSort;
  search: string;
  /** Every other query param, as given. */
  filters: Record<string, string>;
  /** offset for the API: (page − 1) × pageSize. */
  offset: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sort?: TableSort) => void;
  setSearch: (search: string) => void;
  /** Sets (or removes, with "" / undefined) one filter. */
  setFilter: (key: string, value?: string) => void;
  clearFilters: () => void;
}

const RESERVED = new Set(["page", "size", "sort", "q"]);

export interface TableUrlOptions {
  /** Default sort; "newest first" for anything with a date (§3.1). Not written to the URL. */
  defaultSort?: TableSort;
  defaultPageSize?: number;
  /** Prefix params when a page has two tables ("inv" → inv_page, inv_sort…). */
  prefix?: string;
  /** Params on the page that are not table filters (tabs, drawers) and must be left alone. */
  ignore?: string[];
}

export function useTableUrlState({
  defaultSort,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  prefix,
  ignore = [],
}: TableUrlOptions = {}): TableUrlState {
  const [params, setParams] = useSearchParams();
  const name = useCallback((key: string) => (prefix ? `${prefix}_${key}` : key), [prefix]);
  const ignoreKey = ignore.join(",");

  const state = useMemo(() => {
    const page = Math.max(1, Number(params.get(name("page"))) || 1);
    const sizeParam = Number(params.get(name("size")));
    const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam) ? sizeParam : defaultPageSize;
    const sortParam = params.get(name("sort"));
    const [column, direction] = sortParam?.split(":") ?? [];
    const sort: TableSort | undefined =
      column && (direction === "asc" || direction === "desc") ? { column, direction } : defaultSort;
    const filters: Record<string, string> = {};
    const ignored = new Set(ignoreKey ? ignoreKey.split(",") : []);
    params.forEach((value, key) => {
      const bare = prefix ? key.replace(new RegExp(`^${prefix}_`), "") : key;
      if (prefix && bare === key) return;
      if (!RESERVED.has(bare) && !ignored.has(key) && value) filters[bare] = value;
    });
    return { page, pageSize, sort, search: params.get(name("q")) ?? "", filters };
  }, [params, name, prefix, defaultPageSize, defaultSort, ignoreKey]);

  const update = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(name(key), value);
            else next.delete(name(key));
          }
          if (resetPage) next.delete(name("page"));
          return next;
        },
        { replace: true },
      );
    },
    [setParams, name],
  );

  return {
    ...state,
    offset: (state.page - 1) * state.pageSize,
    setPage: (page) => update({ page: page > 1 ? String(page) : undefined }, false),
    setPageSize: (pageSize) => update({ size: pageSize === defaultPageSize ? undefined : String(pageSize) }),
    setSort: (sort) => update({ sort: sort ? `${sort.column}:${sort.direction}` : undefined }),
    setSearch: (search) => update({ q: search.trim() || undefined }),
    setFilter: (key, value) => update({ [key]: value || undefined }),
    clearFilters: () => update(Object.fromEntries(Object.keys(state.filters).map((key) => [key, undefined]))),
  };
}

/** Remembered column choice: falls back to `defaults` when storage is empty, blocked or stale. */
export function usePersistentColumns(
  tableId: string,
  defaults: string[],
): [Set<string>, (columns: Set<string>) => void] {
  const storageKey = `zc.columns.${tableId}`;
  const [columns, setColumns] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved) && saved.length) return new Set(saved.map(String));
    } catch {
      /* storage blocked or invalid: use the defaults */
    }
    return new Set(defaults);
  });
  const save = useCallback(
    (next: Set<string>) => {
      setColumns(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {
        /* storage blocked: the choice lasts for this visit */
      }
    },
    [storageKey],
  );
  return [columns, save];
}
