/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Settings layout, both apps (01 §6.2, 03 A-43, 04 S-07): a white 260px menu card (sticky 28px from the top) and a
 * content column that fills the rest, built from separate white cards 16px apart on the page background.
 * - Below 1280px the menu is a full-width select-style button at the top of the content ("Store profile ▾").
 * - Below 768px the section index (`showList`) is a grouped list of rows with chevrons; a section opens full
 *   screen with a circle back button. Without `back` (console Store detail) the select stays on phone too.
 * The settings search (<SettingsSearch>) finds sections and field labels; picking a field opens its section with
 * `#fieldId` and the shell focuses that field and flashes its label (1.2s).
 * Store detail in the console uses the same card at 220px (`menuWidth="sm"`, 04 S-03).
 */
import { DropdownItem, DropdownSection, DropdownTrigger } from "@heroui/react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PageIconContext } from "../layout/page-icon";
import { Button } from "./Button";
import { Dropdown, DropdownMenu } from "./Dropdown";
import { IconButton } from "./IconButton";
import { IconBack, IconCaret, IconExpand } from "./icons";
import { menuItemDangerClasses, menuPopoverClasses, menuSectionClasses } from "./menu-styles";
import { SearchInput } from "./SearchInput";
import { cx } from "./cx";

type MenuIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface SettingsMenuItem {
  key: string;
  label: string;
  href: string;
  icon?: MenuIcon;
  /** One right-aligned meta, e.g. the Store profile completion ("40%"). */
  meta?: ReactNode;
}

export interface SettingsMenuGroup {
  /** Shown in `micro` (uppercase) above the group. */
  label?: string;
  items: SettingsMenuItem[];
}

/** A menu row that runs an action instead of opening a section (console "Sign out"), last after a divider. */
export interface SettingsMenuAction {
  key: string;
  label: string;
  icon?: MenuIcon;
  onSelect: () => void;
  destructive?: boolean;
}

export interface SettingsShellProps {
  groups: SettingsMenuGroup[];
  activeKey?: string;
  /** Rows after a divider at the end of the menu. */
  footer?: SettingsMenuAction[];
  /**
   * The section index (`/settings`): below 768px the grouped list is the page. From 768px up the app redirects
   * to the first section, so `children` is usually that redirect.
   */
  showList?: boolean;
  /** Phone back button above a section ("Settings"). */
  back?: { href: string; label: string };
  /** 260px (Settings) or 220px (console Store detail). */
  menuWidth?: "md" | "sm";
  /** Sticky offset of the menu card; default 28px from the top. */
  stickyClassName?: string;
  "aria-label": string;
  children: ReactNode;
}

const menuRowClass = (active: boolean) =>
  cx(
    "flex h-[var(--zc-pane-row-h)] w-full items-center gap-2.5 rounded-pane-item px-2.5 text-left text-body transition-colors duration-instant",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    active
      ? "bg-pane-active font-semibold text-fg [&_svg]:text-pane-active-icon"
      : "font-medium text-pane-item hover:bg-pane-hover [&_svg]:text-pane-icon",
  );

const groupLabelClass = "mb-1 ml-2.5 text-micro text-fg-subtle";

export function SettingsShell({
  groups,
  activeKey,
  footer = [],
  showList = false,
  back,
  menuWidth = "md",
  stickyClassName = "top-7",
  children,
  ...rest
}: SettingsShellProps) {
  useSettingsFieldFocus();
  const visible = groups.filter((group) => group.items.length > 0);
  const active = visible.flatMap((group) => group.items).find((item) => item.key === activeKey);

  if (showList) {
    return (
      <>
        <SettingsSectionList groups={visible} footer={footer} aria-label={rest["aria-label"]} />
        <div className="max-md:hidden">{children}</div>
      </>
    );
  }

  return (
    <div
      className={cx(
        "xl:grid xl:items-start xl:gap-4",
        menuWidth === "md" ? "xl:grid-cols-[var(--zc-pane-w)_minmax(0,1fr)]" : "xl:grid-cols-[var(--zc-pane-w-sm)_minmax(0,1fr)]",
      )}
    >
      <nav
        aria-label={rest["aria-label"]}
        className={cx("hidden rounded-2xl border border-line bg-surface p-2 xl:sticky xl:block", stickyClassName)}
      >
        <MenuRows groups={visible} activeKey={activeKey} footer={footer} />
      </nav>

      <div className="min-w-0">
        {back ? (
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <BackCircle to={back.href} label={`Back to ${back.label}`} />
            <span className="text-body font-medium text-fg">{back.label}</span>
          </div>
        ) : null}
        {/* Below 1280px the section select; on phone a page with an index list (Settings) uses the back button instead. */}
        <div className={cx("mb-4 xl:hidden", back && "max-md:hidden")}>
          <SectionSelect
            groups={visible}
            activeKey={activeKey}
            footer={footer}
            label={active?.label ?? rest["aria-label"]}
            menuLabel={rest["aria-label"]}
          />
        </div>
        {/* Sections have their own title-2 headers, not page headers: no section icon box. */}
        <PageIconContext.Provider value={null}>{children}</PageIconContext.Provider>
      </div>
    </div>
  );
}

function BackCircle({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <IconButton aria-label={label} size="sm" onPress={() => navigate(to)}>
      <IconBack aria-hidden />
    </IconButton>
  );
}

/** The menu card's rows; ↑↓ moves between rows. */
function MenuRows({ groups, activeKey, footer }: { groups: SettingsMenuGroup[]; activeKey?: string; footer: SettingsMenuAction[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-pane-row]") ?? []);
    const next = rows[rows.indexOf(document.activeElement as HTMLElement) + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div ref={listRef} onKeyDown={onKeyDown}>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className={index > 0 ? "mt-3" : undefined}>
          {group.label ? <p className={cx(groupLabelClass, "mt-1.5")}>{group.label}</p> : null}
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => {
              const isActive = item.key === activeKey;
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link to={item.href} data-pane-row aria-current={isActive ? "page" : undefined} className={menuRowClass(isActive)}>
                    {Icon ? <Icon aria-hidden /> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.meta != null ? <span className="shrink-0">{item.meta}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {footer.length ? (
        <>
          <div role="separator" className="mx-1 my-2 h-px bg-line" />
          <ul className="flex flex-col gap-px">
            {footer.map((action) => {
              const Icon = action.icon;
              return (
                <li key={action.key}>
                  <button
                    type="button"
                    data-pane-row
                    onClick={action.onSelect}
                    className={cx(menuRowClass(false), action.destructive && "text-tone-danger-text [&_svg]:!text-tone-danger-text")}
                  >
                    {Icon ? <Icon aria-hidden /> : null}
                    <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Below 1280px: "Store profile ▾", secondary md, full width; opens the same groups as a menu. */
function SectionSelect({
  groups,
  activeKey,
  footer,
  label,
  menuLabel,
}: {
  groups: SettingsMenuGroup[];
  activeKey?: string;
  footer: SettingsMenuAction[];
  label: string;
  menuLabel: string;
}) {
  const navigate = useNavigate();
  const items = new Map(groups.flatMap((group) => group.items).map((item) => [item.key, item]));
  const actions = new Map(footer.map((action) => [action.key, action]));

  const sections = groups.map((group, index) => (
    <DropdownSection
      key={group.label ?? `group-${index}`}
      title={group.label}
      classNames={{ heading: cx(menuSectionClasses.heading, "uppercase tracking-wide"), divider: menuSectionClasses.divider }}
    >
      {group.items.map((item) => {
        const Icon = item.icon;
        return (
          <DropdownItem key={item.key} startContent={Icon ? <Icon aria-hidden /> : undefined} endContent={item.meta}>
            {item.label}
          </DropdownItem>
        );
      })}
    </DropdownSection>
  ));
  const footerSection = footer.length ? (
    <DropdownSection key="footer" showDivider={false} classNames={{ divider: menuSectionClasses.divider }}>
      {footer.map((action) => {
        const Icon = action.icon;
        return (
          <DropdownItem
            key={action.key}
            startContent={Icon ? <Icon aria-hidden /> : undefined}
            className={action.destructive ? menuItemDangerClasses : undefined}
          >
            {action.label}
          </DropdownItem>
        );
      })}
    </DropdownSection>
  ) : null;

  return (
    <Dropdown placement="bottom-start" classNames={{ content: "min-w-72" }}>
      <DropdownTrigger>
        <Button variant="secondary" size="md" fullWidth endIcon={<IconCaret aria-hidden />} className="justify-between">
          {label}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={menuLabel}
        selectionMode="single"
        selectedKeys={activeKey ? [activeKey] : []}
        onAction={(key) => {
          const item = items.get(String(key));
          if (item) navigate(item.href);
          else actions.get(String(key))?.onSelect();
        }}
      >
        {footerSection ? [...sections, footerSection] : sections}
      </DropdownMenu>
    </Dropdown>
  );
}

/** Below 768px on the index: grouped rows with chevrons (01 §6.2). */
function SettingsSectionList({
  groups,
  footer,
  ...rest
}: {
  groups: SettingsMenuGroup[];
  footer: SettingsMenuAction[];
  "aria-label": string;
}) {
  const rowClass = "flex min-h-12 w-full items-center gap-3 px-4 text-left text-body font-medium text-fg [&_svg]:size-4 [&_svg]:shrink-0";
  return (
    <nav aria-label={rest["aria-label"]} className="flex flex-col gap-4 md:hidden">
      {groups.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label ? <p className={groupLabelClass}>{group.label}</p> : null}
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link to={item.href} className={rowClass}>
                    {Icon ? <Icon aria-hidden className="text-fg-muted" /> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.meta != null ? <span className="shrink-0">{item.meta}</span> : null}
                    <IconExpand aria-hidden className="text-fg-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {footer.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {footer.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={action.onSelect}
                  className={cx(rowClass, action.destructive && "text-tone-danger-text")}
                >
                  {Icon ? <Icon aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
}

// ─── Field grid ──────────────────────────────────────────────────────────────

/**
 * Settings fields: `repeat(auto-fill, minmax(min(280px, 100%), 1fr))`, 16px gaps (2 columns at 1280 and 1440, more
 * when wider). Give textareas, lists and tables `fieldSpanFull` so they take the whole row.
 */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("zc-field-grid", className)}>{children}</div>;
}

/** Class for a FieldGrid child that spans the full row. */
export const fieldSpanFull = "zc-span-full";

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SettingsSearchEntry {
  /** Unique: the section key, or `${section}:${fieldId}`. */
  key: string;
  /** The section title or the field label. */
  label: string;
  /** The section a field belongs to ("Store profile"); omit for a section entry. */
  section?: string;
  /** Section URL; a field adds `#fieldId`. */
  href: string;
  /** The field's DOM id (its input or card); the shell focuses it and flashes its label. */
  fieldId?: string;
  /** Extra words that should find this entry. */
  keywords?: string[];
}

export interface SettingsSearchProps {
  entries: SettingsSearchEntry[];
  id?: string;
  placeholder?: string;
}

const MAX_RESULTS = 8;

/** Header search, 260px: a result list under the field; sections first, then fields. */
export function SettingsSearch({ entries, id = "settings-search", placeholder = "Search settings" }: SettingsSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = `${id}-results`;

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    const words = text.split(/\s+/);
    const hit = (entry: SettingsSearchEntry) => {
      const hay = [entry.label, entry.section ?? "", ...(entry.keywords ?? [])].join(" ").toLowerCase();
      return words.every((word) => hay.includes(word));
    };
    const matched = entries.filter(hit);
    return [...matched.filter((entry) => !entry.fieldId), ...matched.filter((entry) => entry.fieldId)].slice(0, MAX_RESULTS);
  }, [entries, query]);

  // `/` focuses the search unless the user is typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      document.getElementById(id)?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [id]);

  const pick = (entry: SettingsSearchEntry) => {
    setQuery("");
    setOpen(false);
    navigate(entry.fieldId ? `${entry.href}#${entry.fieldId}` : entry.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setQuery("");
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      setHighlight((index) => (index + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (event.key === "Enter" && results[highlight]) {
      event.preventDefault();
      pick(results[highlight]);
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative w-full sm:w-search-lg sm:shrink-0">
      <SearchInput
        id={id}
        placement="header"
        placeholder={placeholder}
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          setHighlight(0);
          setOpen(true);
        }}
        onClear={() => setQuery("")}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {showList ? (
        <div id={listId} role="listbox" className={cx(menuPopoverClasses, "absolute right-0 top-full z-[var(--zc-z-popover)] mt-1 w-full")}>
          {results.length === 0 ? (
            <p className="px-2.5 py-2 text-small text-fg-muted">No settings match “{query.trim()}”.</p>
          ) : (
            results.map((entry, index) => (
              <button
                key={entry.key}
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(entry)}
                className={cx(
                  "flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left",
                  index === highlight ? "bg-surface-sunken" : undefined,
                )}
              >
                <span className="text-body text-fg">{entry.label}</span>
                {entry.section ? <span className="text-caption text-fg-muted">in {entry.section}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Focus a field from the URL hash ─────────────────────────────────────────

const FLASH_MS = 1200;
const WAIT_MS = 4000;

/**
 * `#fieldId` in the URL (from the settings search): once the field renders (sections load their data first), scroll
 * it to the middle, focus it and flash its label in --zc-primary-soft for 1.2s. A card id works too (no focus).
 */
export function useSettingsFieldFocus() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    const fieldId = decodeURIComponent(hash.replace(/^#/, ""));
    if (!fieldId) return;
    let frame = 0;
    let flashTimer = 0;
    const started = performance.now();
    const tryFocus = () => {
      const target = document.getElementById(fieldId);
      if (!target) {
        if (performance.now() - started < WAIT_MS) frame = requestAnimationFrame(tryFocus);
        return;
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      if (target.matches("input, textarea, select, button, [tabindex]")) target.focus({ preventScroll: true });
      const label =
        document.querySelector<HTMLElement>(`label[for="${CSS.escape(fieldId)}"]`) ??
        target.closest<HTMLElement>("[data-settings-field]") ??
        target;
      label.classList.add("zc-flash");
      flashTimer = window.setTimeout(() => label.classList.remove("zc-flash"), FLASH_MS);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(flashTimer);
    };
  }, [hash, pathname]);
}
