/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";

/** Icon component from the shared registry (src/components/ui/icons.ts). */
export type NavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface NavChild {
  label: string;
  /** Router path (absolute or relative to the layout route, as the project already uses). */
  to: string;
}

export interface NavItem {
  /** Stable id. */
  key: string;
  label: string;
  icon: NavIcon;
  /** Destination for a plain link. Groups may also set it for active-section matching. */
  to?: string;
  /** Exact match for active detection (e.g. "/"). */
  end?: boolean;
  /** Children are shown under the item only while its section is active. */
  children?: NavChild[];
  /** Right-aligned count of things that need action (e.g. orders to fulfil). Hidden when 0. */
  count?: number;
}

export interface Crumb {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

/** One notification in the sidebar panel (docs/design/02-components.md §12). */
export interface NotificationEntry {
  id: string;
  /** Tab it belongs to (e.g. "orders", "payments"); "all" shows everything. */
  category: string;
  title: ReactNode;
  /** One-line detail. */
  detail?: ReactNode;
  /** ISO date or Date; shown as relative time ("2m", "1h", "Mon"). */
  time: string | Date;
  unread: boolean;
  icon?: NavIcon;
  /** Failures get a red tile. */
  critical?: boolean;
  /** Record to open on click. */
  href?: string;
}

/** A row in the user menu at the bottom of the sidebar. */
export interface UserMenuItem {
  key: string;
  label: string;
  onAction: () => void;
  /** Destructive rows (Log out) go last, after a divider. */
  danger?: boolean;
}

/** One result in the ⌘K command palette. */
export interface CommandItem {
  id: string;
  label: string;
  /** Secondary text on the right (section, shortcut, owner email). */
  hint?: ReactNode;
  icon?: NavIcon;
  /** Extra words that should match the query. */
  keywords?: string;
  /** Route to open, or a custom action. */
  href?: string;
  onSelect?: () => void;
}

export interface CommandGroup {
  title: string;
  items: CommandItem[];
}
