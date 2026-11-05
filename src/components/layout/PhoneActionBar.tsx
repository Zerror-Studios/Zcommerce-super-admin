/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { useIsPhone } from "../ui/use-media";

export interface PhoneActionBarProps {
  children?: ReactNode;
  /** Names the region for screen readers ("Order actions"). */
  label?: string;
}

/**
 * Phone only (v2 §10 "Detail pages"): the record's main action (Refund, Save, Receive…) in a sticky bar at the
 * bottom of the content, full-width buttons, stacked 16px above the Zcom AI bar (`--zc-ask-stack`, styles in
 * components.css `.zc-phone-actions`). Renders nothing from 768px up, where the title row holds the action, so a
 * page shows its main action in exactly one place: pass it to the title row only when `useIsPhone()` is false.
 */
export function PhoneActionBar({ children, label = "Page actions" }: PhoneActionBarProps) {
  const isPhone = useIsPhone();
  if (!isPhone || children == null || children === false) return null;
  return (
    <div role="region" aria-label={label} className="zc-phone-actions">
      {children}
    </div>
  );
}
