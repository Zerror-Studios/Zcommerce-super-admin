/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
export { AppShell, ShortcutsList } from "./AppShell";
export { DOCUMENT_TITLE_BRAND, formatDocumentTitle, useDocumentTitle, useShellDocumentTitle } from "./document-title";
export { isSameDay, readStoredFlag, relativeTime, storeFlag, useShellHotkeys } from "./shell-utils";
export type { AppShellProps } from "./AppShell";
export { AskBar, AssistantPanel } from "./Assistant";
export type { AiAnswer, AssistantPanelProps } from "./Assistant";
export { CommandPalette } from "./CommandPalette";
export type { CommandPaletteProps } from "./CommandPalette";
export { NotificationsPopup } from "./NotificationsPanel";
export type { NotificationPopupItem, NotificationPopupTab, NotificationsPopupProps } from "./NotificationsPanel";
export { PageHeader, TitleActions } from "./PageHeader";
export type { PageHeaderProps, TitleActionsProps } from "./PageHeader";
export { PhoneActionBar } from "./PhoneActionBar";
export type { PhoneActionBarProps } from "./PhoneActionBar";
export { SupportBanner } from "./SupportBanner";
export type { SupportBannerProps } from "./SupportBanner";
export { Sidebar, StoreSwitcher } from "./Sidebar";
export type { SidebarProps, SidebarStore, SidebarUser } from "./Sidebar";
export type {
  CommandGroup,
  CommandItem,
  Crumb,
  NavChild,
  NavIcon,
  NavItem,
  NotificationEntry,
  UserMenuItem,
} from "./types";
export { AuthField, AuthLayout } from "./AuthLayout";
export type { AuthFieldProps, AuthLayoutProps } from "./AuthLayout";
export { AskZcomAiContext, useAskZcomAi } from "./ask-context";
export type { AskZcomAi } from "./ask-context";
