/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Command palette (docs/design/02-components.md §13): ⌘K / Ctrl+K anywhere, or the sidebar search.
 * Centred 640px modal, 48px search input, sections (Pages · Stores · Actions …), arrow keys + Enter, Esc closes.
 */
import { ModalBody, ModalContent } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cx } from "../ui/cx";
import { IconSearch } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Kbd } from "../ui/Primitives";
import type { CommandGroup, CommandItem } from "./types";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
}

const MAX_PER_GROUP = 8;

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function CommandPalette({ isOpen, onClose, groups, placeholder = "Search pages and actions" }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () =>
      groups
        .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, query.trim())).slice(0, MAX_PER_GROUP) }))
        .filter((group) => group.items.length > 0),
    [groups, query],
  );
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
      classNames={{ base: "mt-[12vh]" }}
    >
      <ModalContent>
        <ModalBody className="p-0">
          <div className="flex h-12 items-center gap-3 border-b border-line px-4">
            <IconSearch aria-hidden className="size-4 shrink-0 text-fg-subtle" />
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
              className="h-full flex-1 bg-transparent text-base text-fg outline-hidden placeholder:text-fg-placeholder"
              style={{ boxShadow: "none" }}
            />
            <Kbd>Esc</Kbd>
          </div>

          <div id="command-palette-list" ref={listRef} role="listbox" className="custom-scroll max-h-[min(420px,60vh)] overflow-y-auto p-2">
            {visible.length === 0 ? (
              <p className="px-3 py-8 text-center text-body text-fg-muted">No results for "{query}"</p>
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
                          "flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-body text-fg",
                          current === cursor && "bg-surface-sunken",
                        )}
                      >
                        {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" /> : null}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint ? <span className="shrink-0 truncate text-label text-fg-subtle">{item.hint}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
