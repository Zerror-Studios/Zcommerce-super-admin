/**
 * Money in flight (PRD-018 FR-1.2, §6 console)
 *
 * The server's read-only counts of what a suspension or delete would
 * leave open: pending payments, paid orders not fulfilled, refunds,
 * returns, held stock, marketplace listings and platform invoices. When a
 * count timed out the server says `partial` and the panel says so; a
 * delete is then refused until the counts can be read. Rows that block a
 * delete are marked when `highlightBlockers` is on.
 */

import { useQuery } from "@apollo/client";
import { TENANT_MONEY_IN_FLIGHT } from "../../graphql/tenants";
import { isMoneySettled, moneyInFlightRows } from "../../lib/tenant-lifecycle.util";
import type { TenantMoneyInFlight } from "../../types/platform-api";
import { Button as UiButton, Skeleton, cx, formatCount, toneTextClasses } from "../ui";

export interface MoneyInFlightPanelProps {
  tenantId: string;
  /** Mark the rows that stop a delete (FR-2.1). */
  highlightBlockers?: boolean;
  /** Counts from a `MONEY_IN_FLIGHT` refusal, shown instead of the query. */
  override?: Partial<TenantMoneyInFlight> | null;
  className?: string;
}

export function MoneyInFlightPanel({
  tenantId,
  highlightBlockers = false,
  override,
  className,
}: MoneyInFlightPanelProps) {
  const query = useQuery<{ tenantMoneyInFlight: TenantMoneyInFlight }>(TENANT_MONEY_IN_FLIGHT, {
    variables: { id: tenantId },
    fetchPolicy: "network-only",
  });
  const counts = override ?? query.data?.tenantMoneyInFlight;

  return (
    <section
      aria-label="Money in flight"
      className={cx("rounded-tile border border-line px-4 py-3", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-label font-medium text-fg">Money in flight</h3>
        {!override ? (
          <UiButton
            variant="secondary"
            size="sm"
            onPress={() => void query.refetch()}
            isDisabled={query.loading}
          >
            Refresh
          </UiButton>
        ) : null}
      </div>
      {query.loading && !counts ? (
        <div className="space-y-2" role="status" aria-label="Loading the counts">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
      ) : query.error && !counts ? (
        <div role="alert" className="flex items-center justify-between gap-2">
          <p className="text-body text-tone-danger-text">Couldn't read this store's open payments and orders.</p>
          <UiButton variant="secondary" size="sm" onPress={() => void query.refetch()}>
            Retry
          </UiButton>
        </div>
      ) : counts ? (
        <>
          {counts.partial ? (
            <p role="note" className={cx("mb-2 text-label", toneTextClasses.warning)}>
              Some counts couldn't be read in time and show 0. Refresh before you decide.
            </p>
          ) : null}
          {isMoneySettled(counts) && !counts.partial ? (
            <p className="text-body text-fg-muted">Nothing open: no pending payments, orders, refunds or invoices.</p>
          ) : (
            <dl className="flex flex-col gap-1 text-body">
              {moneyInFlightRows(counts).map((row) => {
                const blocking = highlightBlockers && row.blocksDelete && row.count > 0;
                return (
                  // 04 S-03i: the count sits in a fixed 64px column, left-aligned and tabular.
                  <div key={row.key} className="flex items-baseline gap-4">
                    <dt className={cx("min-w-0 flex-1", blocking ? "font-medium text-tone-danger-text" : "text-fg-muted")}>
                      {row.label}
                      {blocking ? <span className="sr-only"> (blocks delete)</span> : null}
                    </dt>
                    <dd className={cx("w-16 shrink-0 text-left num", row.count > 0 ? "text-fg" : "text-fg-subtle")}>
                      {formatCount(row.count)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </>
      ) : null}
    </section>
  );
}
