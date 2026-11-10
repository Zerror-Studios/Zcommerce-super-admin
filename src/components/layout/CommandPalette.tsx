/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Search palette (round 2 G1, docs/review-r2/ROUND-2-FIXES.md): opened by the menu Search box, ⌘K / Ctrl K, or the
 * search icon on phones. A centred 640px pop-up (the Medium size) whose top sits at 14vh, so it never jumps as the
 * results change height; max height 560, radius 22, floating shadow, scrim rgba(11,12,16,.32) with no blur
 * (`.zc-palette` in src/styles/components.css). Phone: a full-screen sheet with the input pinned at the top.
 * - Input: 64px, 17px text, search icon left, "Esc" hint right.
 * - Empty: "Recent" (last 5 opened items, `recentKey` in localStorage) and "Jump to".
 * - Results: grouped under small Mono upper-case headings (Orders, Products, Customers, Pages, Settings …), at most 4
 *   per group plus "See all N orders →"; 48px rows with a 32px icon tile or thumbnail, the title (the match in
 *   semibold), a grey sub-line and a right-aligned type hint.
 * - Keyboard: ↑↓ move, ↵ open, ⌘↵ / Ctrl ↵ open in a new tab, Tab / Shift Tab jump between groups, Esc closes.
 * - Speed: `onSearch` runs 120ms after typing stops (2+ characters); a term searched before shows its cached
 *   groups at once, and the last results stay on screen while a new search runs.
 * The overlay is the palette's own (not a HeroUI modal), so the click that opens it can never close it.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useHref, useNavigate } from "react-router-dom";
import { cx } from "../ui/cx";
import { IconSearch } from "../ui/icons";
import { DUR_2_S, EXIT_S, usePresetMotion } from "../ui/motion";
import { Kbd } from "../ui/Primitives";
import { Spinner } from "../ui/Spinner";
import { useIsPhone } from "../ui/use-media";

import type { CommandGroup, CommandItem } from "./types";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** Local groups, filtered as the user types (Pages, Settings, Stores, Actions …), shown after the server groups. */
  groups: CommandGroup[];
  placeholder?: string;
  /** LEGACY: ignored. v2 §3.1: search is search only; the Zcom AI bar is the one place to ask. */
  onAskAi?: (query: string) => void;
  /** Server search; resolves to groups (with total / showAllHref for "See all N …"). */
  onSearch?: (query: string) => Promise<CommandGroup[]>;
  /** localStorage key for recent items; recents are off without it. */
  recentKey?: string;
  /** "Jump to" rows on the empty palette (Orders, Products, Customers, Settings). */
  jumpTo?: CommandItem[];
}

const MAX_PER_GROUP = 4;
const MAX_RECENT = 5;
const SEARCH_DEBOUNCE_MS = 120;
const MIN_QUERY = 2;
/** Cached server answers kept per palette (most recent terms). */
const CACHE_LIMIT = 30;

type RecentItem = Pick<CommandItem, "id" | "label" | "href" | "description"> & { hint?: string };

function readRecent(key?: string): RecentItem[] {
  if (!key) return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item) => item?.id && item?.href).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(key: string | undefined, item: CommandItem) {
  if (!key || !item.href) return;
  const entry: RecentItem = {
    id: item.id,
    label: item.label,
    href: item.href,
    description: item.description,
    hint: typeof item.hint === "string" ? item.hint : undefined,
  };
  const next = [entry, ...readRecent(key).filter((recent) => recent.id !== item.id)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage blocked: no recents */
  }
}

/** At most 4 rows, then "See all 23 orders →" when the server found more. */
function withSeeAll(group: CommandGroup): CommandItem[] {
  const items = group.items.slice(0, MAX_PER_GROUP);
  if (group.showAllHref && group.total != null && group.total > items.length) {
    const noun = group.noun ?? group.title.toLowerCase();
    items.push({
      id: `${group.title}-see-all`,
      label: `See all ${group.total.toLocaleString("en-IN")} ${noun} →`,
      href: group.showAllHref,
    });
  }
  return items;
}

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.label} ${item.keywords ?? ""} ${item.description ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

/** The title with every query word in semibold. */
function highlight(label: string, query: string): ReactNode {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return label;
  const lower = label.toLowerCase();
  const marks = new Array<boolean>(label.length).fill(false);
  for (const word of words) {
    let from = lower.indexOf(word);
    while (from !== -1) {
      for (let i = from; i < from + word.length; i += 1) marks[i] = true;
      from = lower.indexOf(word, from + word.length);
    }
  }
  const parts: ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= label.length; i += 1) {
    if (i === label.length || marks[i] !== marks[start]) {
      const text = label.slice(start, i);
      parts.push(marks[start] ? <b key={start} className="font-semibold text-fg">{text}</b> : <Fragment key={start}>{text}</Fragment>);
      start = i;
    }
  }
  return parts;
}

export function CommandPalette({
  isOpen,
  onClose,
  groups,
  placeholder = "Search orders, products, customers and pages",
  onSearch,
  recentKey,
  jumpTo = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [serverGroups, setServerGroups] = useState<CommandGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const navigate = useNavigate();
  // The router's base ("/store/<handle>/" in the store, "/" in the console) for ⌘↵ new tabs.
  const base = useHref("/").replace(/\/$/, "");
  const isPhone = useIsPhone();
  const sheetMotion = usePresetMotion("sheet");
  const popupMotion = usePresetMotion("popup");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const cache = useRef(new Map<string, CommandGroup[]>());
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecent(readRecent(recentKey));
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [isOpen, recentKey]);

  // Server search: cached terms at once, others 120ms after typing stops; the last answer stays while it runs.
  useEffect(() => {
    const term = query.trim().toLowerCase();
    const id = ++requestId.current;
    if (!onSearch || term.length < MIN_QUERY) {
      setServerGroups([]);
      setSearching(false);
      return undefined;
    }
    const cached = cache.current.get(term);
    if (cached) setServerGroups(cached);
    setSearching(true);
    const timer = window.setTimeout(() => {
      onSearch(query.trim())
        .then((found) => {
          cache.current.set(term, found);
          if (cache.current.size > CACHE_LIMIT) cache.current.delete(cache.current.keys().next().value as string);
          if (id === requestId.current) setServerGroups(found);
        })
        .catch(() => {
          if (id === requestId.current && !cached) setServerGroups([]);
        })
        .finally(() => {
          if (id === requestId.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  const asked = query.trim();
  const visible = useMemo<CommandGroup[]>(() => {
    if (!asked) {
      const empty: CommandGroup[] = [];
      if (recent.length) empty.push({ title: "Recent", items: recent });
      if (jumpTo.length) empty.push({ title: "Jump to", items: jumpTo });
      return empty;
    }
    const remote = serverGroups
      .map((group) => ({ ...group, items: withSeeAll(group) }))
      .filter((group) => group.items.length > 0);
    // Local groups: at most 4 too; with `showAllHref` the "See all N" row opens it with ?q= (the list's search).
    const local = groups
      .map((group) => {
        const found = group.items.filter((item) => matches(item, asked));
        const href = group.showAllHref
          ? `${group.showAllHref}${group.showAllHref.includes("?") ? "&" : "?"}q=${encodeURIComponent(asked)}`
          : undefined;
        return { ...group, items: withSeeAll({ ...group, items: found, total: found.length, showAllHref: href }) };
      })
      .filter((group) => group.items.length > 0);
    return [...remote, ...local];
  }, [asked, groups, jumpTo, recent, serverGroups]);
  const flat = useMemo(() => visible.flatMap((group) => group.items), [visible]);
  const groupStarts = useMemo(() => {
    const starts: number[] = [];
    let index = 0;
    for (const group of visible) {
      starts.push(index);
      index += group.items.length;
    }
    return starts;
  }, [visible]);

  useEffect(() => {
    if (cursor > flat.length - 1) setCursor(Math.max(0, flat.length - 1));
  }, [cursor, flat.length]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor]);

  // Reset on close so the next open starts empty; focus goes back to the opener.
  const close = useCallback(() => {
    setQuery("");
    setCursor(0);
    onClose();
    const target = returnFocus.current;
    returnFocus.current = null;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }, [onClose]);

  const run = (item: CommandItem | undefined, newTab = false) => {
    if (!item) return;
    if (!item.id.endsWith("-see-all")) saveRecent(recentKey, item);
    if (newTab && item.href) {
      window.open(`${base}${item.href}`, "_blank", "noopener");
      return;
    }
    close();
    if (item.onSelect) item.onSelect();
    else if (item.href) navigate(item.href);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(flat[cursor], event.metaKey || event.ctrlKey);
    } else if (event.key === "Tab") {
      // Tab cycles the groups (focus stays in the input, so the palette keeps focus inside itself).
      event.preventDefault();
      if (!groupStarts.length) return;
      const current = groupStarts.reduce((found, start, index) => (cursor >= start ? index : found), 0);
      const next = (current + (event.shiftKey ? -1 : 1) + groupStarts.length) % groupStarts.length;
      setCursor(groupStarts[next]);
    }
  };

  let index = -1;
  const activeId = flat[cursor] ? `command-${flat[cursor].id}` : undefined;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div key="zc-palette" className="zc-palette-layer" onKeyDown={onKeyDown}>
          <motion.div
            aria-hidden
            className="zc-palette-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR_2_S } }}
            exit={{ opacity: 0, transition: { duration: EXIT_S } }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="zc-palette"
            variants={(isPhone ? sheetMotion : popupMotion).variants}
            initial="initial"
            animate="enter"
            exit="exit"
          >
            <div className="zc-palette__input-row">
              <IconSearch aria-hidden className="size-5 shrink-0 text-fg-subtle" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                role="combobox"
                aria-expanded
                aria-autocomplete="list"
                aria-controls="command-palette-list"
                aria-activedescendant={activeId}
                className="zc-palette__input"
              />
              {searching ? <Spinner size="sm" aria-label="Searching" /> : null}
              {isPhone ? (
                <button type="button" onClick={close} className="zc-palette__cancel">
                  Cancel
                </button>
              ) : (
                <Kbd>Esc</Kbd>
              )}
            </div>

            <div id="command-palette-list" ref={listRef} role="listbox" aria-label="Results" className="zc-palette__list custom-scroll">
              {visible.length === 0 ? (
                asked && !searching ? (
                  <p className="px-3 py-8 text-center text-label text-fg-muted">No matches for "{asked}"</p>
                ) : !asked ? (
                  <p className="px-3 py-8 text-center text-label text-fg-muted">Type to search.</p>
                ) : null
              ) : (
                visible.map((group) => (
                  <div key={group.title} role="group" aria-label={group.title} className="zc-palette__group">
                    <p aria-hidden className="zc-palette__heading">{group.title}</p>
                    {group.items.map((item) => {
                      index += 1;
                      const current = index;
                      const Icon = item.icon;
                      const seeAll = item.id.endsWith("-see-all");
                      return (
                        <div
                          key={item.id}
                          id={`command-${item.id}`}
                          data-index={current}
                          role="option"
                          aria-selected={current === cursor}
                          onMouseMove={() => setCursor(current)}
                          onClick={(event) => run(item, event.metaKey || event.ctrlKey)}
                          onAuxClick={(event) => {
                            if (event.button === 1) run(item, true);
                          }}
                          className={cx("zc-palette__row", seeAll && "zc-palette__row--more", current === cursor && "is-active")}
                        >
                          {seeAll ? null : item.imageUrl ? (
                            <img src={item.imageUrl} alt="" loading="lazy" className="zc-palette__thumb" />
                          ) : (
                            <span aria-hidden className="zc-palette__tile">
                              {Icon ? <Icon className="size-4" /> : <IconSearch className="size-4" />}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body text-fg">{seeAll ? item.label : highlight(item.label, asked)}</span>
                            {item.description ? (
                              <span className="block truncate text-caption text-fg-muted">{item.description}</span>
                            ) : null}
                          </span>
                          {item.hint ? <span className="shrink-0 truncate text-caption text-fg-subtle">{item.hint}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            {isPhone ? null : (
              <p aria-hidden className="zc-palette__foot">
                ↑↓ move · ↵ open · ⌘↵ new tab · Tab next group · Esc close
              </p>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
