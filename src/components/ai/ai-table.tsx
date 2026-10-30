/**
 * Shared pieces of the ZCOM AI table card (04 S-06): the toolbar row (tab switch on the left, search and the
 * tab's own controls on the right), the store cell and the error card.
 */
import type { ReactNode } from "react";
import { Card, ErrorState } from "../ui";

/** Toolbar row: the tab switch left, the search and per-tab controls right; they wrap under it when narrow. */
export function AiToolbar({ tabs, children }: { tabs: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2">
      <div className="min-w-0 max-w-full">{tabs}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 md:ml-auto">{children}</div>
    </div>
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

/** The table card when its read failed: the toolbar stays so the tabs still work. */
export function AiErrorCard({ tabs, title, description, onRetry }: { tabs: ReactNode; title: string; description: string; onRetry: () => void }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <AiToolbar tabs={tabs} />
      <ErrorState title={title} description={description} onRetry={onRetry} />
    </Card>
  );
}
