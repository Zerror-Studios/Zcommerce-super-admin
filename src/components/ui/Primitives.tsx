/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
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
  /** Show only when the form is dirty. */
  isVisible: boolean;
  onDiscard: () => void;
  onSave: () => void;
  isSaving?: boolean;
  message?: ReactNode;
  saveLabel?: string;
  discardLabel?: string;
}

/** Sticky bar for forms and settings: "Unsaved changes · Discard · Save". Slides away after saving. */
export function SaveBar({
  isVisible,
  onDiscard,
  onSave,
  isSaving = false,
  message = "Unsaved changes",
  saveLabel = "Save",
  discardLabel = "Discard",
}: SaveBarProps) {
  return (
    <div
      aria-hidden={!isVisible}
      className={cx(
        "sticky bottom-4 z-[var(--zc-z-sticky)] mx-auto mt-6 flex w-full max-w-content-form items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-2.5 shadow-popover transition-all duration-base ease-standard",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <span className="text-body font-medium text-fg">{message}</span>
      <span className="flex items-center gap-2">
        <Button variant="ghost" size="sm" isDisabled={isSaving || !isVisible} onPress={onDiscard}>
          {discardLabel}
        </Button>
        <Button variant="primary" size="sm" isLoading={isSaving} isDisabled={!isVisible} onPress={onSave}>
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
        "inline-flex h-5 items-center rounded-xs border px-1.5 font-mono text-caption",
        dark ? "border-nav-border text-nav-fg-muted" : "border-line bg-surface-muted text-fg-muted",
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

/** Small toggle inside a card (chart metric, "Top pages by"): 28px on a muted track. */
export function SegmentedControl<T extends string>({ options, value, onChange, className, ...rest }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cx("inline-flex h-7 items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5", className)}
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
              "h-6 rounded-md px-2.5 text-label font-medium transition-colors duration-fast",
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
