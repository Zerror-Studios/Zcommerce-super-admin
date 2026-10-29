/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { createContext, type ReactNode } from "react";

/**
 * The icon of the sidebar section the page belongs to (owner 2026-10-29: every page header has its icon box).
 * The app layout provides it; a PageHeader without its own `icon` uses it. `null` turns it off (the settings
 * card's sections have plain pane headers).
 */
export const PageIconContext = createContext<ReactNode>(undefined);
