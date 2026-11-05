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

/**
 * Tiny control on an image: white at 92%, radius 6, icon 12px. Shown on tile hover with a mouse, always on touch,
 * where its hit area is 44px (keep 22px between two controls there).
 */
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
        // zc-hit: a 44px hit area on touch screens, same look (v2 §10).
        "zc-hit inline-flex items-center justify-center rounded-sm bg-image-control text-fg shadow-sticky transition-colors duration-instant [&_svg]:size-3",
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
    <span className={cx("rounded-xs bg-image-control px-1.5 py-0.5 text-caption font-semibold text-fg", className)}>
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

/** Two-icon view switch (v2 §4.8 `.zc-view`): white pill, the selected icon on ink. Same look as TableToolbar's ViewSwitch. */
export function ViewToggle({ value, onChange, className }: { value: ViewMode; onChange: (mode: ViewMode) => void; className?: string }) {
  const options: { mode: ViewMode; label: string; icon: ReactNode }[] = [
    { mode: "grid", label: "Grid view", icon: <IconGridView aria-hidden /> },
    { mode: "list", label: "List view", icon: <IconListView aria-hidden /> },
  ];
  return (
    <div role="radiogroup" aria-label="View" className={cx("zc-view", className)}>
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={option.mode === value}
          aria-label={option.label}
          onClick={() => onChange(option.mode)}
          className="zc-view__item"
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export interface AvatarProps {
  /** Full name: initials and the gradient come from it. */
  name: string;
  src?: string | null;
  /** sm 24, sm28 28 (the sidebar owner row), md 32, lg 40, xl 64 (profile headers). */
  size?: "sm" | "sm28" | "md" | "lg" | "xl";
  className?: string;
}

const avatarSizes = {
  sm: "size-6 text-micro normal-case tracking-normal",
  sm28: "size-7 text-micro normal-case tracking-normal",
  md: "size-8 text-caption",
  lg: "size-10 text-body",
  xl: "size-16 text-title-2",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Photo when there is one; otherwise dark initials on neutral grey (v2 §2.1: no coloured or gradient avatars). */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const base = cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", avatarSizes[size], className);
  if (src && !failed) {
    return <img src={src} alt="" className={cx(base, "object-cover")} onError={() => setFailed(true)} loading="lazy" />;
  }
  return (
    <span aria-hidden className={cx(base, "bg-avatar font-semibold text-avatar-fg")}>
      {initials(name)}
    </span>
  );
}
