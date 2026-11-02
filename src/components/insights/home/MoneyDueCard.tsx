/**
 * Home block 1, money due this week (backend PRD-026 FR-7.1, guide §3).
 * Read live: open invoices due within 7 days, overdue included, already
 * sorted most overdue first. A ₹ total and the store count, then one row
 * per store (amount, days overdue or "due on …", an overdue chip), each
 * linking to the store's billing. The caller hides it when `moneyDue` is
 * null (no `platform:billing:read`).
 */

import { Link } from "react-router-dom";

import { Card, Chip, Skeleton } from "../../ui";
import { formatMoney } from "../../ui/money";
import { moneyDueWhen } from "../../../lib/platform-insights.util";
import type { PlatformAttention } from "../../../types/platform-insights";

export interface MoneyDueCardProps {
  moneyDue: NonNullable<PlatformAttention["moneyDue"]> | null;
  isLoading?: boolean;
}

export function MoneyDueCard({ moneyDue, isLoading = false }: MoneyDueCardProps) {
  const count = moneyDue?.storeCount ?? 0;
  return (
    <Card
      title="Money due this week"
      description={
        isLoading || !moneyDue
          ? undefined
          : `${formatMoney(moneyDue.total, { whole: true })} from ${count} ${count === 1 ? "store" : "stores"}`
      }
      padding="none"
    >
      {isLoading ? (
        <div className="flex flex-col gap-2 px-5 pb-5">
          <Skeleton className="h-6 w-full rounded-md" />
          <Skeleton className="h-6 w-full rounded-md" />
        </div>
      ) : !moneyDue || moneyDue.items.length === 0 ? (
        <p className="px-5 pb-5 text-body text-fg-muted">Nothing due this week.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {moneyDue.items.map((row) => (
            <li key={row.tenantId}>
              <Link
                to={`/stores/${row.tenantId}/billing`}
                className="flex items-center gap-3 px-5 py-3 transition-colors duration-fast hover:bg-row-hover focus-visible:shadow-focus-strong focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-fg">{row.name}</span>
                  <span className="block text-caption text-fg-muted">
                    {moneyDueWhen(row)}
                    {row.invoiceCount > 1 ? ` · ${row.invoiceCount} invoices` : ""}
                  </span>
                </span>
                {row.overdue ? <Chip tone="danger">Overdue</Chip> : <Chip tone="neutral">Due</Chip>}
                <span className="num w-28 shrink-0 text-right text-body font-medium text-fg">
                  {formatMoney(row.amount, { whole: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default MoneyDueCard;
