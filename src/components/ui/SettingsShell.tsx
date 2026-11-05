/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Settings layout, both apps (design v2 boards 48–57):
 * - From 1024px a full-height white menu column flush against the black sidebar (it cancels the page's left and
 *   top padding and sticks to the top while the content scrolls): the "Settings" heading, an optional search, the
 *   grouped sections (icon rows, the open one on a grey pill), then at the bottom an optional progress card
 *   ("Store setup · 4 of 11 done", green bar) and the footer rows (a red "Log out").
 * - The content sits on the page background: each section starts with its title row (<PaneHeader>), then an optional
 *   <SettingsInsight> and white 22px cards.
 * - Below 1024px the menu is a full-width select-style button ("Store details ▾") with the search beside it.
 * - Below 768px the section index (`showList`) is the heading, the search and a grouped list of rows with chevrons;
 *   a section opens full screen with a circle back button. Without `back` the select stays on phone too.
 * The settings search (<SettingsSearch>) finds sections and field labels; picking a field opens its section with
 * `#fieldId` and the shell focuses that field and flashes its label (1.2s).
 */
import { DropdownItem, DropdownSection, DropdownTrigger } from "@heroui/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PageIconContext } from "../layout/page-icon";
import { Button } from "./Button";
import { Dropdown, DropdownMenu } from "./Dropdown";
import { IconButton } from "./IconButton";
import { IconBack, IconCaret, IconCheck, IconExpand } from "./icons";
import { menuItemDangerClasses, menuPopoverClasses, menuSectionClasses } from "./menu-styles";
import { Orb } from "./Orb";
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

/** A menu row that runs an action instead of opening a section ("Log out"), at the bottom of the menu. */
export interface SettingsMenuAction {
  key: string;
  label: string;
  icon?: MenuIcon;
  onSelect: () => void;
  destructive?: boolean;
}

/** The card above the footer rows: "Store setup · 4 of 11 done" with a green bar. Only from real data. */
export interface SettingsProgress {
  label: string;
  done: number;
  total: number;
  /** Where the card goes (the full checklist). */
  href?: string;
}

export interface SettingsShellProps {
  groups: SettingsMenuGroup[];
  activeKey?: string;
  /** Rows at the bottom of the menu (Log out). */
  footer?: SettingsMenuAction[];
  /**
   * The section index (`/settings`): below 768px the grouped list is the page. From 768px up the app redirects
   * to the first section, so `children` is usually that redirect.
   */
  showList?: boolean;
  /** Phone back button above a section ("Settings"). */
  back?: { href: string; label: string };
  /** The menu heading, also the phone index title. Default "Settings". */
  title?: string;
  /** One muted line under the heading (the store name and address). */
  subtitle?: ReactNode;
  /** The settings search (<SettingsSearch fullWidth />): under the heading in the menu, beside the select below 1024px. */
  search?: ReactNode;
  /** Optional progress card at the bottom of the menu. */
  progress?: SettingsProgress | null;
  "aria-label": string;
  children: ReactNode;
}

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True from 1024px: the menu column shows (the search renders once, in the column or beside the select). */
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);
}

/** "Log out": red text and icon, red hover (owner, 2026-11-04), like the account menu's Log out. */
const destructiveRowClass = "!text-tone-danger-text [&_svg]:!text-tone-danger-text hover:!bg-tone-danger-soft";

// Board rows: 36px pills, 14/500, grey icons; the open section on a grey pill.
const menuRowClass = (active: boolean) =>
  cx(
    "flex h-[var(--zc-pane-row-h)] w-full items-center gap-2.5 rounded-full px-3 text-left text-body font-medium transition-colors duration-instant",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    active
      ? "bg-pane-active text-fg [&_svg]:text-pane-active-icon"
      : "text-pane-item hover:bg-pane-hover [&_svg]:text-pane-icon",
  );

const groupLabelClass = "px-3 pb-1.5 pt-3.5 text-micro text-fg-subtle";

export function SettingsShell({
  groups,
  activeKey,
  footer = [],
  showList = false,
  back,
  title = "Settings",
  subtitle,
  search,
  progress,
  children,
  ...rest
}: SettingsShellProps) {
  useSettingsFieldFocus();
  const isWide = useIsWide();
  const visible = groups.filter((group) => group.items.length > 0);
  const active = visible.flatMap((group) => group.items).find((item) => item.key === activeKey);

  if (showList) {
    return (
      <>
        <div className="flex flex-col gap-4 md:hidden">
          <div>
            <h1 className="text-title-1 text-fg">{title}</h1>
            {subtitle != null ? <p className="mt-0.5 text-body text-fg-muted">{subtitle}</p> : null}
          </div>
          {search && !isWide ? search : null}
          <SettingsSectionList groups={visible} footer={footer} progress={progress} aria-label={rest["aria-label"]} />
        </div>
        <div className="max-md:hidden">{children}</div>
      </>
    );
  }

  return (
    // From 1024px: cancel the page's left and top padding (32px, 28px) so the menu meets the sidebar and the top,
    // and its bottom clearance, so the column runs to the bottom; the content keeps the clearance itself.
    <div className="lg:-mb-ask-clearance lg:-ml-8 lg:-mt-7 lg:flex">
      {isWide ? (
        <nav
          aria-label={rest["aria-label"]}
          className={cx(
            "sticky top-0 flex h-dvh w-pane shrink-0 flex-col self-start border-r border-line bg-surface px-3 pb-3.5 pt-5.5",
            // On screens wider than the page container, the white runs on to the sidebar (main clips it).
            "before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-screen before:bg-surface",
          )}
        >
          <div className="px-3">
            <p className="text-title-2 text-fg">{title}</p>
            {subtitle != null ? <p className="mt-0.5 text-caption text-fg-muted">{subtitle}</p> : null}
          </div>
          {search ? <div className="mt-3">{search}</div> : null}
          <div className="custom-scroll -mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
            <MenuRows groups={visible} activeKey={activeKey} />
          </div>
          {progress ? <ProgressCard progress={progress} /> : null}
          {footer.length ? <FooterRows footer={footer} className={progress ? "mt-2" : undefined} /> : null}
        </nav>
      ) : null}

      <div className="min-w-0 flex-1 lg:pb-ask-clearance lg:pl-8 lg:pt-6">
        <div className="mx-auto w-full max-w-4xl">
          {back ? (
            <div className="mb-3 flex items-center gap-2 md:hidden">
              <BackCircle to={back.href} label={`Back to ${back.label}`} />
              <span className="text-body font-medium text-fg">{back.label}</span>
            </div>
          ) : null}
          {/* Below 1024px the section select and the search; on phone a page with an index list uses the back button. */}
          {isWide ? null : (
            <div className={cx("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center", back && "max-md:hidden")}>
              <div className="min-w-0 flex-1">
                <SectionSelect
                  groups={visible}
                  activeKey={activeKey}
                  footer={footer}
                  label={active?.label ?? rest["aria-label"]}
                  menuLabel={rest["aria-label"]}
                />
              </div>
              {search ? <div className="sm:w-search-lg sm:shrink-0">{search}</div> : null}
            </div>
          )}
          {/* Sections have their own title rows, not page headers: no section icon box. */}
          <PageIconContext.Provider value={null}>{children}</PageIconContext.Provider>
        </div>
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

/** The menu's section rows; ↑↓ moves between rows. */
function MenuRows({ groups, activeKey }: { groups: SettingsMenuGroup[]; activeKey?: string }) {
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
        <div key={group.label ?? index} className={!group.label && index > 0 ? "mt-3" : undefined}>
          {group.label ? <p className={groupLabelClass}>{group.label}</p> : null}
          <ul className="flex flex-col gap-0.5">
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
    </div>
  );
}

/** "Log out" and other action rows at the bottom of the menu. */
function FooterRows({ footer, className }: { footer: SettingsMenuAction[]; className?: string }) {
  return (
    <ul className={cx("flex flex-col gap-0.5", className)}>
      {footer.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.key}>
            <button
              type="button"
              onClick={action.onSelect}
              className={cx(menuRowClass(false), action.destructive && destructiveRowClass)}
            >
              {Icon ? <Icon aria-hidden /> : null}
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Store setup · 4 of 11 done" with a green bar (board 48). The bar is a scaled fill: transform only. */
function ProgressCard({ progress, className }: { progress: SettingsProgress; className?: string }) {
  const total = Math.max(0, progress.total);
  const done = Math.min(Math.max(0, progress.done), total);
  const ratio = total > 0 ? done / total : 0;
  const body = (
    <>
      <IconCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-pane-icon" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium text-fg">{progress.label}</span>
        <span className="block text-caption text-fg-muted num">
          {done} of {total} done
        </span>
        <span
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-sunken"
        >
          <span className="block h-full origin-left rounded-full bg-tone-success" style={{ transform: `scaleX(${ratio})` }} />
        </span>
      </span>
    </>
  );
  const cardClass = cx(
    "flex items-start gap-2.5 rounded-2xl border border-line bg-surface-muted px-3 py-2.5 text-left",
    progress.href && "transition-colors duration-instant hover:bg-pane-hover",
    className,
  );
  return progress.href ? (
    <Link to={progress.href} className={cardClass}>
      {body}
    </Link>
  ) : (
    <div className={cardClass}>{body}</div>
  );
}

/** Below 1024px: "Store details ▾", secondary md, full width; opens the same groups as a menu. */
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

/** Below 768px on the index: grouped rows with chevrons, then the progress card and the footer rows. */
function SettingsSectionList({
  groups,
  footer,
  progress,
  ...rest
}: {
  groups: SettingsMenuGroup[];
  footer: SettingsMenuAction[];
  progress?: SettingsProgress | null;
  "aria-label": string;
}) {
  const rowClass = "flex min-h-12 w-full items-center gap-3 px-4 text-left text-body font-medium text-fg [&_svg]:size-4 [&_svg]:shrink-0";
  return (
    <nav aria-label={rest["aria-label"]} className="flex flex-col gap-4">
      {groups.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label ? <p className="mb-1 ml-2.5 text-micro text-fg-subtle">{group.label}</p> : null}
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
      {progress ? <ProgressCard progress={progress} className="bg-surface" /> : null}
      {footer.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {footer.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={action.onSelect}
                  className={cx(rowClass, action.destructive && destructiveRowClass)}
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

// ─── Insight line ────────────────────────────────────────────────────────────

export interface SettingsInsightProps {
  /** One sentence: the fact in 600, then what to do. */
  children: ReactNode;
  /** Replaces the orb: a ProgressRing for a completion (Store details). */
  lead?: ReactNode;
  /** One secondary sm button or link on the right. */
  action?: ReactNode;
  id?: string;
  className?: string;
}

/**
 * The light-blue banner under a section's title row (boards 48, 53): the orb (or a progress ring), one sentence,
 * one action. Only from real data; leave it out when there is nothing true to say.
 */
export function SettingsInsight({ children, lead, action, id, className }: SettingsInsightProps) {
  return (
    <section
      id={id}
      className={cx(
        "flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-2xl border border-ai-line-border bg-[image:var(--zc-ai-line-bg)] px-4 py-3.5",
        className,
      )}
    >
      <span className="flex shrink-0 items-center">{lead ?? <Orb />}</span>
      <div className="min-w-0 flex-1 basis-64 text-body text-fg">{children}</div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </section>
  );
}

// ─── Save in the title row ───────────────────────────────────────────────────

export interface SettingsSaveButtonsProps {
  /** Something differs from the saved values: Discard shows and Save turns on. */
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
  /** "3 unsaved changes" before the buttons. */
  dirtyCount?: number;
  /** Fields with errors: "Fix 2 fields to save" in red. */
  errorCount?: number;
  /** Replaces "Unsaved changes". */
  message?: ReactNode;
  saveLabel?: string;
  discardLabel?: string;
}

/**
 * Save in a settings title row (boards 48, 50–52, 54): the primary "✓ Save changes" pill, on once something
 * changed; then "Discard" (secondary) and a short status ("2 changes", "Fix 1 field to save") appear before it.
 */
export function SettingsSaveButtons({
  isDirty,
  onSave,
  onDiscard,
  isSaving = false,
  dirtyCount,
  errorCount = 0,
  message,
  saveLabel = "Save changes",
  discardLabel = "Discard",
}: SettingsSaveButtonsProps) {
  const hasErrors = isDirty && errorCount > 0;
  const status = hasErrors
    ? `Fix ${errorCount} ${errorCount === 1 ? "field" : "fields"} to save`
    : (message ?? (dirtyCount ? `${dirtyCount} unsaved ${dirtyCount === 1 ? "change" : "changes"}` : "Unsaved changes"));
  return (
    <>
      <span
        role={hasErrors ? "alert" : "status"}
        className={cx("text-label num", hasErrors ? "font-medium text-tone-danger-text" : "text-fg-muted", !isDirty && "sr-only")}
      >
        {isDirty ? status : null}
      </span>
      {isDirty ? (
        <Button variant="secondary" isDisabled={isSaving} onPress={onDiscard}>
          {discardLabel}
        </Button>
      ) : null}
      <Button variant="primary" startIcon={<IconCheck aria-hidden />} isLoading={isSaving} isDisabled={!isDirty} onPress={onSave}>
        {saveLabel}
      </Button>
    </>
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
  /** Fill the parent (the settings menu column) instead of the 260px header width. */
  fullWidth?: boolean;
}

const MAX_RESULTS = 8;

/** Settings search: a result list under the field; sections first, then fields. */
export function SettingsSearch({ entries, id = "settings-search", placeholder = "Search settings", fullWidth = false }: SettingsSearchProps) {
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
    <div className={cx("relative w-full", !fullWidth && "sm:w-search-lg sm:shrink-0")}>
      <SearchInput
        id={id}
        placement={fullWidth ? "field" : "header"}
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
