/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Browser tab titles (round 2 G14): "‹Record› · ‹Section› · Zcom", e.g. "Handwoven Jute Tote · Products · Zcom" or
 * "Order #1880 · Orders · Zcom". The layout owns the title (section from the navigation config, see
 * `useShellDocumentTitle`); a record page adds its record with `useDocumentTitle` while it is mounted. The layout's
 * effect runs after the page's (parents commit last), so the record is published to a tiny store the layout reads,
 * instead of each writing document.title in turn.
 */
import { useEffect, useSyncExternalStore } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecordTitle {
  record: string;
  /** Overrides the layout's section label (when the record lives under another menu entry). */
  section?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DOCUMENT_TITLE_BRAND = "Zcom";
const SEPARATOR = " · ";

// ─── Store ───────────────────────────────────────────────────────────────────

let entries: RecordTitle[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The innermost record (the last mounted page that set one); a stable reference until it changes. */
function currentRecord(): RecordTitle | undefined {
  return entries[entries.length - 1];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "Order #1880 · Orders · Zcom"; empty parts are left out ("Orders · Zcom", "Zcom"). */
export function formatDocumentTitle(
  record: string | null | undefined,
  section: string | null | undefined,
  brand: string = DOCUMENT_TITLE_BRAND,
): string {
  return [record?.trim(), section?.trim(), brand].filter(Boolean).join(SEPARATOR);
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * A record page names its record in the tab title: `useDocumentTitle(product?.title)` on the product editor gives
 * "Handwoven Jute Tote · Products · Zcom". Nothing is shown until the record is known (pass undefined while loading);
 * the title goes back to the section when the page unmounts. `section` overrides the menu's label when needed.
 */
export function useDocumentTitle(record: string | null | undefined, section?: string | null): void {
  useEffect(() => {
    const text = record?.trim();
    if (!text) return undefined;
    const entry: RecordTitle = { record: text, section: section?.trim() || undefined };
    entries = [...entries, entry];
    emit();
    return () => {
      entries = entries.filter((item) => item !== entry);
      emit();
    };
  }, [record, section]);
}

/**
 * The layout's half: writes document.title from the menu section (`sectionLabel`, from the navigation config) and the
 * record a page published, with the app's brand at the end.
 */
export function useShellDocumentTitle(sectionLabel: string | null | undefined, brand: string = DOCUMENT_TITLE_BRAND): void {
  const record = useSyncExternalStore(subscribe, currentRecord, currentRecord);
  useEffect(() => {
    document.title = formatDocumentTitle(record?.record, record?.section ?? sectionLabel, brand);
  }, [record, sectionLabel, brand]);
}
