/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Small shared pieces from docs/design/02-components.md that had no component before:
 * BackLink (§2), SaveBar (§2), CopyableId (§18), Kbd (§13), SegmentedControl (§8).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconBack, IconCheck, IconDuplicate } from "./icons";
import { Tooltip } from "./Tooltip";

// ─── BackLink ────────────────────────────────────────────────────────────────

export interface BackLinkProps {
  to: string;
  /** The parent list: "Products". Rendered as "← Products". */
  children: ReactNode;
  className?: string;
}

/** One back link above a detail/edit page title (13px secondary). Replaces breadcrumbs on detail pages. */
export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex items-center gap-1 rounded-sm text-label text-fg-muted transition-colors duration-instant hover:text-fg",
        className,
      )}
    >
      <IconBack aria-hidden className="size-3.5" />
      {children}
    </Link>
  );
}

// ─── SaveBar ─────────────────────────────────────────────────────────────────

export interface SaveBarProps {
  /** Show only when something differs from the saved values. */
  isVisible: boolean;
  onDiscard: () => void;
  onSave: () => void;
  isSaving?: boolean;
  /** How many fields changed: the second line reads "3 changes". */
  dirtyCount?: number;
  /** Fields with errors: the bar reads "Fix 2 fields to save" in red. */
  errorCount?: number;
  /** Replaces the first line ("Unsaved changes"). */
  message?: ReactNode;
  saveLabel?: string;
  discardLabel?: string;
}

/**
 * Floating save bar (02 §7.1): at the bottom of the content column, 16px up; white, radius 16, 1px border, popover
 * shadow, 64px, padding 12 16; rises 12px and fades in (220ms). Left "Unsaved changes" + "3 changes"; right
 * secondary "Discard" and primary "Save changes". The AI bar hides while it shows. One save bar per page.
 */
export function SaveBar({
  isVisible,
  onDiscard,
  onSave,
  isSaving = false,
  dirtyCount,
  errorCount = 0,
  message,
  saveLabel = "Save changes",
  discardLabel = "Discard",
}: SaveBarProps) {
  // Tells the shell to hide the AI bar (components.css: html[data-zc-savebar]).
  useEffect(() => {
    if (!isVisible) return undefined;
    document.documentElement.dataset.zcSavebar = "open";
    return () => {
      delete document.documentElement.dataset.zcSavebar;
    };
  }, [isVisible]);

  const hasErrors = errorCount > 0;
  return (
    <div
      aria-hidden={!isVisible}
      role="region"
      aria-label="Unsaved changes"
      className={cx(
        "sticky bottom-4 z-[var(--zc-z-sticky)] mt-6 flex min-h-16 w-full items-center justify-between gap-3 rounded-[var(--zc-radius-card)] border border-line bg-surface px-4 py-3 shadow-popover transition-[opacity,transform] duration-base ease-enter",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <span className="min-w-0">
        {hasErrors ? (
          <span className="block text-body font-medium text-tone-danger-text" role="alert">
            Fix {errorCount} {errorCount === 1 ? "field" : "fields"} to save
          </span>
        ) : (
          <>
            <span className="block truncate text-body font-medium text-fg">{message ?? "Unsaved changes"}</span>
            {dirtyCount ? (
              <span className="block text-label text-fg-muted num">
                {dirtyCount} {dirtyCount === 1 ? "change" : "changes"}
              </span>
            ) : null}
          </>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" isDisabled={isSaving || !isVisible} onPress={onDiscard}>
          {discardLabel}
        </Button>
        <Button variant="primary" isLoading={isSaving} isDisabled={!isVisible} onPress={onSave}>
          {saveLabel}
        </Button>
      </span>
    </div>
  );
}

// ─── CopyableId ──────────────────────────────────────────────────────────────

export interface CopyableIdProps {
  /** Order number, SKU, transaction ID or discount code. */
  value: string;
  /** What is shown (defaults to value), e.g. "#1042". */
  children?: ReactNode;
  className?: string;
}

/** Geist Mono ID; click copies it, the icon turns into ✓ for 1.2s with a "Copied" tooltip. */
export function CopyableId({ value, children, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const Icon = copied ? IconCheck : IconDuplicate;
  return (
    <Tooltip content={copied ? "Copied" : "Copy"} isOpen={copied || undefined}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
        }}
        className={cx(
          "group inline-flex items-center gap-1 rounded-sm font-mono text-body text-fg transition-colors duration-instant hover:text-brand",
          className,
        )}
      >
        {children ?? value}
        <Icon aria-hidden className={cx("size-3.5 text-fg-subtle", !copied && "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")} />
      </button>
    </Tooltip>
  );
}

// ─── Kbd ─────────────────────────────────────────────────────────────────────

/** Keyboard shortcut hint ("⌘K"): Geist Mono, 4px radius. Pass dark on the sidebar. */
export function Kbd({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <kbd
      className={cx(
        "zc-kbd",
        dark && "zc-kbd--dark",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// ─── SegmentedControl ────────────────────────────────────────────────────────

export interface SegmentedControlProps<T extends string> {
  /** Option values are the same strings as `value`; typed loosely so plain string arrays work. */
  options: { value: string; label: ReactNode }[];
  value: T;
  /** NoInfer: T comes from `value`, so a state setter (Dispatch<SetStateAction<T>>) fits. */
  onChange: (value: NoInfer<T>) => void;
  "aria-label": string;
  className?: string;
}

/**
 * The one segmented control (docs/design/09-settings-and-scale.md §2): 32px pill group on a muted track, the
 * same everywhere (All · Mobile · Desktop, 30 · 90 · Year, Visits · Time · Exits). Never mixed with underline
 * tabs in the same row.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, className, ...rest }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cx("inline-flex h-8 items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value as T)}
            className={cx(
              "h-7 rounded-md px-3 text-label font-medium transition-colors duration-fast",
              selected ? "bg-surface text-fg shadow-sticky" : "text-fg-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
