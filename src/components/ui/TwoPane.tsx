/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The two-pane card (docs/design/09-settings-and-scale.md §1, §2B): one card, a 260px list of things on the
 * left, the selected one on the right. Used by Settings, campaign channel pages, Roles, Locations, plans…
 * Below 1024px it stacks: the list is the page, and opening an item shows only the detail with a back link.
 * From 1024px (owner 2026-10-29): the card is at least the screen's height below the page header, so the list
 * keeps its size when a section is short, and the list sticks to the top while a long section scrolls.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageIconContext } from "../layout/page-icon";
import { BackLink } from "./Primitives";
import { cx } from "./cx";

// ─── Card ────────────────────────────────────────────────────────────────────

export interface TwoPaneCardProps {
  /** Left pane content, usually <PaneList>. */
  list: ReactNode;
  /** Right pane content: <PaneHeader> then stacked cards. */
  children: ReactNode;
  /**
   * Narrow screens only: true shows the detail (with `back`), false shows the list. Wide screens show both.
   * Typically "an item is selected in the URL".
   */
  showDetail: boolean;
  /** Back link above the detail on narrow screens ("← Settings"). */
  back?: { href: string; label: ReactNode };
  className?: string;
}

export function TwoPaneCard({ list, children, showDetail, back, className }: TwoPaneCardProps) {
  return (
    // overflow-clip (not hidden) keeps the rounded corners without making the card a scroll box, so the
    // list can stick. 13rem ≈ the app's top padding plus a page header.
    <div className={cx("overflow-clip rounded-panel border border-line bg-surface lg:flex lg:min-h-[calc(100dvh-13rem)]", className)}>
      <aside
        className={cx(
          "shrink-0 bg-pane px-2.5 py-3 lg:w-pane lg:border-r lg:border-line",
          showDetail && "hidden lg:block",
        )}
      >
        {/* Below a sticky page header when there is one (it sets --zc-sticky-header-h), else 16px from the top. */}
        <div className="lg:sticky lg:top-[calc(var(--zc-sticky-header-h,0px)+1rem)]">{list}</div>
      </aside>
      <div className={cx("min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-7 sm:pt-6", !showDetail && "hidden lg:block")}>
        {back ? (
          <BackLink to={back.href} className="mb-3 lg:hidden">
            {back.label}
          </BackLink>
        ) : null}
        {/* Sections here have pane headers, not page headers: no section icon box. */}
        <PageIconContext.Provider value={null}>{children}</PageIconContext.Provider>
      </div>
    </div>
  );
}

// ─── List ────────────────────────────────────────────────────────────────────

export interface PaneItem {
  key: string;
  label: ReactNode;
  /** 16px stroke icon. */
  icon?: ReactNode;
  /** One right-aligned meta: a count or a small badge. Never more than one. */
  meta?: ReactNode;
  /** Router link (deep-linkable sections); otherwise the item calls onSelect. */
  href?: string;
}

export interface PaneGroup {
  /** 12/600 group label; omit for an ungrouped list. */
  label?: ReactNode;
  items: PaneItem[];
}

export interface PaneListProps {
  groups: PaneGroup[];
  activeKey?: string;
  onSelect?: (key: string) => void;
  /** Optional search field (the shared SearchInput) above the groups. */
  search?: ReactNode;
  /** Shown when every group is empty (e.g. nothing matches the search). */
  emptyContent?: ReactNode;
  "aria-label": string;
}

const itemClass = (active: boolean) =>
  cx(
    "flex h-9 w-full items-center gap-2.5 rounded-pane-item px-2.5 text-left text-label font-medium transition-colors duration-instant",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    active
      ? "bg-pane-active text-fg [&_svg]:text-pane-active-icon"
      : "text-pane-item hover:bg-pane-hover [&_svg]:text-pane-icon",
  );

/** Grouped list for the left pane: 36px rows, radius 9, slate active row, ↑↓ moves between rows. */
export function PaneList({ groups, activeKey, onSelect, search, emptyContent, ...rest }: PaneListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const visible = groups.filter((group) => group.items.length > 0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-pane-row]") ?? []);
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <nav aria-label={rest["aria-label"]}>
      {search ? <div className="mb-2 px-0.5">{search}</div> : null}
      <div ref={listRef} onKeyDown={onKeyDown}>
        {visible.length === 0 ? (
          <div className="px-2.5 py-3 text-label text-fg-muted">{emptyContent ?? "Nothing here yet."}</div>
        ) : null}
        {visible.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.label ? (
              <p className={cx("mb-1 ml-2.5 text-caption font-semibold text-pane-label", groupIndex === 0 ? "mt-1" : "mt-3.5")}>
                {group.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => {
                const active = item.key === activeKey;
                const content = (
                  <>
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.meta != null ? <span className="shrink-0 text-caption text-fg-subtle">{item.meta}</span> : null}
                  </>
                );
                return (
                  <li key={item.key}>
                    {item.href ? (
                      <Link
                        to={item.href}
                        data-pane-row
                        aria-current={active ? "page" : undefined}
                        className={itemClass(active)}
                        onClick={() => onSelect?.(item.key)}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        data-pane-row
                        aria-current={active ? "true" : undefined}
                        className={itemClass(active)}
                        onClick={() => onSelect?.(item.key)}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── Right pane header ───────────────────────────────────────────────────────

export interface PaneHeaderProps {
  title: ReactNode;
  /** One muted sentence of what the section does. */
  description?: ReactNode;
  /** Badge next to the title (campaign status, On/Off). */
  badges?: ReactNode;
  /** At most one primary button ("+ Add shipping profile"), plus ghost extras before it. */
  actions?: ReactNode;
  className?: string;
}

/** H2 18/600 → one muted line → actions right; 16px above the first card. */
export function PaneHeader({ title, description, badges, actions, className }: PaneHeaderProps) {
  return (
    <div className={cx("mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-heading font-semibold text-fg">{title}</h2>
          {badges}
        </div>
        {description != null ? <p className="mt-0.5 text-body text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
