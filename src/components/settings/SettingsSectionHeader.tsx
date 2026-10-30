import type { ReactNode } from "react";
import { PaneHeader } from "../ui";
import type { SettingsSectionKey } from "./settings-routes";
import { SETTINGS_SECTIONS } from "./settings-sections";

/** A section's title (title-2), its one-line description and its primary action on the right (04 S-07). */
export function SettingsSectionHeader({
  section,
  actions,
  badges,
}: {
  section: SettingsSectionKey;
  actions?: ReactNode;
  badges?: ReactNode;
}) {
  const meta = SETTINGS_SECTIONS[section];
  return <PaneHeader title={meta.label} description={meta.description} actions={actions} badges={badges} />;
}
