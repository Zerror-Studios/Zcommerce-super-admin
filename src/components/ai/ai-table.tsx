/**
 * Shared pieces of the ZCOM AI tables (04 S-06): the toolbar row (tab switch on the left, search and the
 * tab's own controls on the right), the store cell and the error card.
 *
 * Design v2 §4.3: the toolbar is the standard one (`.zc-toolbar`, the kit TableToolbar's layout) and sits ABOVE
 * the table card: DataTable renders its `toolbar` outside the card, and the error card does the same.
 */
import type { ReactNode } from "react";
import { ToolbarRow, ToolbarSearch, type ToolbarSearchProps } from "../common/TableToolbar";
import { Card, ErrorState } from "../ui";

/**
 * Toolbar row: the tab switch left; right, the search then the tab's own controls. Phone (v2 §10, the kit rules):
 * the tabs scroll sideways in their own row and the search is an icon that opens a full-width field.
 */
export function AiToolbar({ tabs, search, children }: { tabs: ReactNode; search?: ToolbarSearchProps; children?: ReactNode }) {
  return (
    <ToolbarRow>
      <div className="zc-toolbar__tabs">{tabs}</div>
      {search || children ? (
        <div className="zc-toolbar__end flex-wrap">
          {search ? <ToolbarSearch {...search} /> : null}
          {children}
        </div>
      ) : null}
    </ToolbarRow>
  );
}

/** Two-line store cell: name, slug under it. */
export function StoreCell({ name, slug }: { name: string; slug?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-fg">{name}</p>
      {slug ? <p className="truncate text-label text-fg-muted">{slug}</p> : null}
    </div>
  );
}

/** The table card when its read failed: the toolbar stays above it so the tabs still work. */
export function AiErrorCard({ tabs, title, description, onRetry }: { tabs: ReactNode; title: string; description: string; onRetry: () => void }) {
  return (
    <div className="zc-table-wrap">
      <AiToolbar tabs={tabs} />
      <Card padding="none" className="overflow-hidden">
        <ErrorState title={title} description={description} onRetry={onRetry} />
      </Card>
    </div>
  );
}
