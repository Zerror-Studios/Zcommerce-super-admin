/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { IconUpgrade } from "../ui/icons";

export interface SidebarCreditProps {
  version: string;
}

/** Footer credit (original Store Dashboard style): 12px, bold studio name. */
export function SidebarCredit({ version }: SidebarCreditProps) {
  return (
    <div className="px-2 text-fg">
      <p className="text-caption">
        Developed by{" "}
        <a
          href="https://www.zerrorstudios.com/"
          target="_blank"
          rel="noreferrer"
          className="rounded-sm font-bold outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          Zerror Studios
        </a>
      </p>
      <p className="text-caption">
        © {new Date().getFullYear()} | Version {version}
      </p>
    </div>
  );
}

export interface SidebarUpgradeCardProps {
  message: string;
  actionLabel: string;
  onAction?: () => void;
  /** Icon only when the sidebar is collapsed. */
  collapsed?: boolean;
}

/** Upgrade card (original Store Dashboard style, Store Dashboard slot): muted tile, icon, caption, full-width button. */
export function SidebarUpgradeCard({ message, actionLabel, onAction, collapsed = false }: SidebarUpgradeCardProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-sm bg-surface-muted px-2 py-3 text-center">
      <IconUpgrade aria-hidden className={cx("size-4", collapsed ? "text-brand" : "text-fg")} />
      {!collapsed ? (
        <>
          <p className="text-caption text-fg">{message}</p>
          <Button variant="primary" size="sm" fullWidth onPress={onAction}>
            {actionLabel}
          </Button>
        </>
      ) : null}
    </div>
  );
}
