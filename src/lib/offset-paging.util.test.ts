import { describe, expect, it } from "vitest";
import {
  isPageGuardReached,
  MAX_AUTO_PAGES,
  mergeOffsetList,
  mergeOffsetPage,
  nextOffset,
} from "./offset-paging.util";

const page = (from: number, count: number, totalCount: number) => ({
  items: Array.from({ length: count }, (_, index) => ({ id: from + index })),
  totalCount,
});

describe("offset paging (FE-09)", () => {
  it("appends a later page at its offset", () => {
    const first = mergeOffsetPage(undefined, page(0, 100, 120), { offset: 0 });
    const both = mergeOffsetPage(first, page(100, 20, 120), { offset: 100 });
    expect(both.items).toHaveLength(120);
    expect(both.items[119]).toEqual({ id: 119 });
    expect(both.totalCount).toBe(120);
  });

  it("replaces the list on offset 0 (refetch after a delete)", () => {
    const both = mergeOffsetPage(
      mergeOffsetPage(undefined, page(0, 100, 120), { offset: 0 }),
      page(100, 20, 120),
      { offset: 100 },
    );
    const refetched = mergeOffsetPage(both, page(0, 100, 119), { offset: 0 });
    expect(refetched.items).toHaveLength(100);
    expect(refetched.totalCount).toBe(119);
  });

  it("asks for the next offset until the list is complete", () => {
    expect(nextOffset(page(0, 100, 120), 100)).toBe(100);
    expect(nextOffset(page(0, 120, 120), 100)).toBeNull();
    expect(nextOffset(undefined, 100)).toBeNull();
  });

  it("stops on an empty page or at the page guard", () => {
    expect(nextOffset(page(0, 100, 150), 100, 0)).toBeNull();
    const huge = page(0, 100 * MAX_AUTO_PAGES, 100 * MAX_AUTO_PAGES + 1);
    expect(nextOffset(huge, 100)).toBeNull();
  });

  it("continues past the guard once the budget is raised (W2V2-06)", () => {
    const huge = page(0, 100 * MAX_AUTO_PAGES, 100 * MAX_AUTO_PAGES + 1);
    expect(isPageGuardReached(huge, 100)).toBe(true);
    expect(nextOffset(huge, 100, null, MAX_AUTO_PAGES * 2)).toBe(
      100 * MAX_AUTO_PAGES,
    );
    expect(isPageGuardReached(huge, 100, MAX_AUTO_PAGES * 2)).toBe(false);
    expect(isPageGuardReached(page(0, 100, 150), 100)).toBe(false);
    expect(isPageGuardReached(page(0, 120, 120), 1, 1)).toBe(false);
  });
});

describe("offset paging over a plain array (coupons, PRD-014 close-out)", () => {
  const rows = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: from + index }));

  it("appends a later page at its offset", () => {
    const first = mergeOffsetList(undefined, rows(0, 100), { offset: 0 });
    const both = mergeOffsetList(first, rows(100, 5), { offset: 100 });
    expect(both).toHaveLength(105);
    expect(both[104]).toEqual({ id: 104 });
  });

  it("replaces the list on offset 0 (refetch after a create)", () => {
    const both = mergeOffsetList(rows(0, 100), rows(100, 5), { offset: 100 });
    expect(mergeOffsetList(both, rows(0, 3), { offset: 0 })).toHaveLength(3);
    expect(mergeOffsetList(both, rows(0, 3), null)).toHaveLength(3);
  });

  it("pages with nextOffset against the sibling count", () => {
    expect(nextOffset({ items: rows(0, 100), totalCount: 150 }, 100)).toBe(100);
    expect(nextOffset({ items: rows(0, 150), totalCount: 150 }, 100)).toBeNull();
  });
});
