/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Small shared pieces for images and tiles (docs/design/08-fixes-and-screens.md §1.4, §1.6, §1.8):
 * ImageControl (20–22px buttons on a photo), CoverTag, ViewToggle + useViewMode (grid/list, remembered per
 * page), Avatar (photo or gradient initials).
 */
import { useCallback, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconGridView, IconListView } from "./icons";

// ─── Image controls ──────────────────────────────────────────────────────────

export interface ImageControlProps {
  "aria-label": string;
  onPress: () => void;
  children: ReactNode;
  /** md 22px (edit, delete), sm 20px (remove, drag handle on collection tiles). */
  size?: "sm" | "md";
  /** Danger tint on hover (delete / remove). */
  destructive?: boolean;
  className?: string;
}

/** Tiny control on an image: white at 92%, radius 6, icon 12px. Usually shown on tile hover only. */
export function ImageControl({ onPress, children, size = "md", destructive, className, ...rest }: ImageControlProps) {
  return (
    <button
      type="button"
      aria-label={rest["aria-label"]}
      onClick={(event) => {
        event.stopPropagation();
        onPress();
      }}
      className={cx(
        "inline-flex items-center justify-center rounded-sm bg-image-control text-fg shadow-sticky transition-colors duration-instant [&_svg]:size-3",
        size === "md" ? "size-image-control" : "size-image-control-sm",
        destructive ? "hover:text-tone-danger" : "hover:bg-surface",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** "Cover" on the first image: 10px, white pill. */
export function CoverTag({ children = "Cover", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx("rounded-xs bg-image-control px-1.5 py-0.5 text-micro font-semibold text-fg", className)}>
      {children}
    </span>
  );
}

// ─── Grid / list ─────────────────────────────────────────────────────────────

export type ViewMode = "grid" | "list";

/** The grid/list choice for one page, remembered in localStorage (falls back to `initial`). */
export function useViewMode(pageId: string, initial: ViewMode = "grid"): [ViewMode, (mode: ViewMode) => void] {
  const key = `zc.view.${pageId}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === "grid" || saved === "list") return saved;
    } catch {
      /* storage blocked */
    }
    return initial;
  });
  const save = useCallback(
    (next: ViewMode) => {
      setMode(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* storage blocked: lasts for this visit */
      }
    },
    [key],
  );
  return [mode, save];
}

/** 28px two-icon segmented toggle, top-right of a card that shows tiles. */
export function ViewToggle({ value, onChange, className }: { value: ViewMode; onChange: (mode: ViewMode) => void; className?: string }) {
  const options: { mode: ViewMode; label: string; icon: ReactNode }[] = [
    { mode: "grid", label: "Grid view", icon: <IconGridView aria-hidden /> },
    { mode: "list", label: "List view", icon: <IconListView aria-hidden /> },
  ];
  return (
    <div role="radiogroup" aria-label="View" className={cx("inline-flex h-7 items-center gap-0.5 rounded-field bg-surface-sunken p-0.5", className)}>
      {options.map((option) => {
        const selected = option.mode === value;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            onClick={() => onChange(option.mode)}
            className={cx(
              "inline-flex h-6 w-7 items-center justify-center rounded-md transition-colors duration-fast [&_svg]:size-3.5",
              selected ? "bg-surface text-fg shadow-sticky" : "text-fg-muted hover:text-fg",
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export interface AvatarProps {
  /** Full name: initials and the gradient come from it. */
  name: string;
  src?: string | null;
  /** sm 24, md 32, lg 40. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const avatarSizes = { sm: "size-6 text-micro", md: "size-8 text-caption", lg: "size-10 text-body" };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** One of the six avatar gradients, stable per name. */
function gradientFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `var(--zc-avatar-${(hash % 6) + 1})`;
}

/** Photo when there is one; otherwise white initials on a gradient (customers, team, the user row). */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const base = cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", avatarSizes[size], className);
  if (src && !failed) {
    return <img src={src} alt="" className={cx(base, "object-cover")} onError={() => setFailed(true)} loading="lazy" />;
  }
  return (
    <span aria-hidden className={cx(base, "font-semibold text-brand-on")} style={{ background: gradientFor(name) }}>
      {initials(name)}
    </span>
  );
}
