/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType } from "react";

/** Icon component from the shared registry (src/components/ui/icons.ts). */
export type NavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface NavChild {
  label: string;
  /** Router path (absolute or relative to the layout route, as the project already uses). */
  to: string;
}

export interface NavItem {
  /** Stable id; used as the open-group key. */
  key: string;
  label: string;
  icon: NavIcon;
  /** Destination for a plain link. Groups may also set it for active-section matching. */
  to?: string;
  /** Exact match for active detection (e.g. "/"). */
  end?: boolean;
  children?: NavChild[];
}

export interface Crumb {
  label: string;
  /** Omit for the current page. */
  href?: string;
}
