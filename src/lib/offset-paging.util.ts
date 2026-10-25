/**
 * Offset paging over the platform-admin lists (PRD-014 FE-09)
 *
 * The backend clamps every list to 100 rows (`MAX_PAGE_LIMIT`, 200 for
 * payments), so a console list is read page by page with `offset`. The
 * Apollo field policy below writes each page at its offset into one cached
 * list (items stay normalised, so a mutation that returns the entity still
 * updates the row), and `nextOffset` says what to ask for next.
 */

// ─── Constants ────────────────────────────────────────────────────────────

/** The backend's page cap for tenants, users and the audit log. */
export const SERVER_PAGE_LIMIT = 100;

/** The backend's page cap (and default) for `platformCoupons`. */
export const COUPONS_PAGE_LIMIT = 100;

/** The backend's page cap for `platformPayments`. */
export const PAYMENTS_PAGE_LIMIT = 200;

/**
 * Stop reading a list after this many pages (a guard, not a product limit).
 * A screen can raise its own budget by this step when the user asks for
 * more (W2V2-06).
 */
export const MAX_AUTO_PAGES = 50;

// ─── Types ────────────────────────────────────────────────────────────────

export interface OffsetPage<T> {
  items: T[];
  totalCount: number;
}

interface PageArgs {
  offset?: number | null;
}

// ─── Merge ────────────────────────────────────────────────────────────────

/**
 * Apollo `merge` for an `{ items, totalCount }` list read with `offset`.
 * Offset 0 (first read, refetch) replaces the list, so a deleted store
 * doesn't linger; a later offset writes its page in place.
 */
export function mergeOffsetPage<T>(
  existing: OffsetPage<T> | undefined,
  incoming: OffsetPage<T>,
  args: PageArgs | null | undefined,
): OffsetPage<T> {
  const offset = Math.max(0, Number(args?.offset ?? 0) || 0);
  if (offset === 0 || !existing) {
    return { ...incoming, items: [...incoming.items] };
  }
  const items = existing.items.slice(0, offset);
  items.push(...incoming.items);
  return { ...incoming, items };
}

/**
 * Apollo `merge` for a plain array read with `offset` whose total comes from
 * a sibling count field (`platformCoupons` + `platformCouponCount`). Same
 * rule as `mergeOffsetPage`: offset 0 replaces, a later offset writes in place.
 */
export function mergeOffsetList<T>(
  existing: readonly T[] | undefined,
  incoming: readonly T[],
  args: PageArgs | null | undefined,
): T[] {
  const offset = Math.max(0, Number(args?.offset ?? 0) || 0);
  if (offset === 0 || !existing) return [...incoming];
  return [...existing.slice(0, offset), ...incoming];
}

/** An Apollo field policy for an offset-paged plain array (PRD-014 close-out). */
export function offsetListPolicy(keyArgs: string[]) {
  return {
    keyArgs,
    merge: (
      existing: readonly unknown[] | undefined,
      incoming: readonly unknown[],
      { args }: { args: PageArgs | null },
    ) => mergeOffsetList(existing, incoming, args),
  };
}

/** An Apollo field policy for an offset-paged list keyed by `keyArgs`. */
export function offsetPagingPolicy(keyArgs: string[]) {
  return {
    keyArgs,
    merge: (
      existing: OffsetPage<unknown> | undefined,
      incoming: OffsetPage<unknown>,
      { args }: { args: PageArgs | null },
    ) => mergeOffsetPage(existing, incoming, args),
  };
}

// ─── Next page ────────────────────────────────────────────────────────────

/**
 * The offset of the next page, or `null` when the list is complete, the
 * last page came back empty (`lastPageSize === 0`, so the count was stale)
 * or the page guard (`maxPages`) is reached.
 */
export function nextOffset(
  page: OffsetPage<unknown> | undefined,
  pageSize: number,
  lastPageSize: number | null = null,
  maxPages: number = MAX_AUTO_PAGES,
): number | null {
  if (!page) return null;
  const loaded = page.items.length;
  if (loaded >= page.totalCount) return null;
  if (lastPageSize === 0) return null;
  if (isPageGuardReached(page, pageSize, maxPages)) return null;
  return loaded;
}

/**
 * True when paging stopped at the page guard with rows still on the server,
 * so a "Retry" would do nothing until the screen raises `maxPages`
 * (W2V2-06).
 */
export function isPageGuardReached(
  page: OffsetPage<unknown> | undefined,
  pageSize: number,
  maxPages: number = MAX_AUTO_PAGES,
): boolean {
  if (!page) return false;
  const loaded = page.items.length;
  return loaded < page.totalCount && loaded >= pageSize * maxPages;
}
