/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Command palette (docs/design/02-components.md §13, 09 §3.3): ⌘K / Ctrl+K anywhere, or the sidebar search.
 * Centred 640px modal, 48px search input, sections (Products · Orders · Pages · Actions …), arrow keys + Enter,
 * Esc closes. With `onSearch`, typing (2+ characters, 300ms debounce) asks the server and its groups come first,
 * 5 each with "Show all N". Before typing, the last 5 opened items show as Recent.
 */
import { ModalBody, ModalContent } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "../ui/Spinner";
import { useNavigate } from "react-router-dom";
import { cx } from "../ui/cx";
import { IconSearch } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Sparkle } from "../ui/Ai";
import { Kbd } from "../ui/Primitives";

const AskIcon = ({ className }: { className?: string }) => <Sparkle className={className} />;
import type { CommandGroup, CommandItem } from "./types";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
  /** When the `ai` flag is on: last row "Ask AI: ‹query›" opens the assistant with the query. */
  onAskAi?: (query: string) => void;
  /** Server search; resolves to groups with up to 5 items (and total / showAllHref). */
  onSearch?: (query: string) => Promise<CommandGroup[]>;
  /** localStorage key for recent items; recents are off without it. */
  recentKey?: string;
}

const MAX_PER_GROUP = 8;
const MAX_RECENT = 5;
const SEARCH_DEBOUNCE = 300;

type RecentItem = Pick<CommandItem, "id" | "label" | "href"> & { hint?: string };

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
  const entry: RecentItem = { id: item.id, label: item.label, href: item.href, hint: typeof item.hint === "string" ? item.hint : undefined };
  const next = [entry, ...readRecent(key).filter((recent) => recent.id !== item.id)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage blocked: no recents */
  }
}

/** Appends "Show all N" when the server found more than it returned. */
function withShowAll(group: CommandGroup): CommandItem[] {
  const items = group.items.slice(0, 5);
  if (group.showAllHref && group.total != null && group.total > items.length) {
    items.push({ id: `${group.title}-show-all`, label: `Show all ${group.total.toLocaleString("en-IN")}`, href: group.showAllHref });
  }
  return items;
}

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function CommandPalette({
  isOpen,
  onClose,
  groups,
  placeholder = "Search pages and actions",
  onAskAi,
  onSearch,
  recentKey,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [serverGroups, setServerGroups] = useState<CommandGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (isOpen) setRecent(readRecent(recentKey));
  }, [isOpen, recentKey]);

  useEffect(() => {
    const term = query.trim();
    const id = ++requestId.current;
    if (!onSearch || term.length < 2) {
      setServerGroups([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      onSearch(term)
        .then((found) => {
          if (id === requestId.current) setServerGroups(found);
        })
        .catch(() => {
          if (id === requestId.current) setServerGroups([]);
        })
        .finally(() => {
          if (id === requestId.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  const visible = useMemo(() => {
    const asked = query.trim();
    const local = groups
      .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, asked)).slice(0, MAX_PER_GROUP) }))
      .filter((group) => group.items.length > 0);
    const remote = asked
      ? serverGroups.map((group) => ({ ...group, items: withShowAll(group) })).filter((group) => group.items.length > 0)
      : [];
    const recentGroup: CommandGroup[] = !asked && recent.length ? [{ title: "Recent", items: recent }] : [];
    const found = [...recentGroup, ...remote, ...local];
    if (onAskAi && asked) {
      found.push({
        title: "Assistant",
        items: [{ id: "ask-ai", label: `Ask Zcom AI: ${asked}`, icon: AskIcon, onSelect: () => onAskAi(asked) }],
      });
    }
    return found;
  }, [groups, query, onAskAi, serverGroups, recent]);
  const flat = useMemo(() => visible.flatMap((group) => group.items), [visible]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Reset on close so the next open starts empty.
  const close = () => {
    setQuery("");
    setCursor(0);
    onClose();
  };

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    if (!item.id.endsWith("-show-all")) saveRecent(recentKey, item);
    close();
    if (item.onSelect) item.onSelect();
    else if (item.href) navigate(item.href);
  };

  let index = -1;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      width="md"
      placement="top"
      hideCloseButton
      classNames={{ base: "!mt-6 md:!mt-16 md:!max-h-[480px] overflow-hidden", body: "!p-0" }}
    >
      <ModalContent>
        <ModalBody className="flex min-h-0 flex-col">
          <div className="flex h-13 shrink-0 items-center gap-3 border-b border-line-subtle px-4">
            <IconSearch aria-hidden className="size-4.5 shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((value) => Math.min(value + 1, flat.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((value) => Math.max(value - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  run(flat[cursor]);
                }
              }}
              placeholder={placeholder}
              aria-label={placeholder}
              role="combobox"
              aria-expanded
              aria-controls="command-palette-list"
              aria-activedescendant={flat[cursor] ? `command-${flat[cursor].id}` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-body text-fg outline-hidden placeholder:text-fg-placeholder max-md:text-base"
              style={{ boxShadow: "none" }}
            />
            {searching ? <Spinner size="sm" aria-label="Searching" /> : null}
            <Kbd>Esc</Kbd>
          </div>

          <div id="command-palette-list" ref={listRef} role="listbox" className="custom-scroll min-h-0 flex-1 overflow-y-auto p-2 md:max-h-[396px]">
            {visible.length === 0 ? (
              query.trim() && !searching ? (
              <p className="px-3 py-6 text-center text-label text-fg-muted">No matches for "{query.trim()}"</p>
              ) : null
            ) : (
              visible.map((group) => (
                <div key={group.title} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-caption font-medium text-fg-subtle">{group.title}</p>
                  {group.items.map((item) => {
                    index += 1;
                    const current = index;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        id={`command-${item.id}`}
                        data-index={current}
                        role="option"
                        aria-selected={current === cursor}
                        onMouseMove={() => setCursor(current)}
                        onClick={() => run(item)}
                        className={cx(
                          "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-body text-fg",
                          current === cursor && "bg-surface-sunken",
                        )}
                      >
                        {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" /> : null}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint ? <span className="shrink-0 truncate text-caption text-fg-subtle">{item.hint}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <p aria-hidden className="flex h-8 shrink-0 items-center border-t border-line-subtle px-4 text-caption text-fg-muted">
            ↑↓ to move · ↵ to open · Esc to close
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
