/**
 * Store payments still pending after 48 h (PRD-018 FR-1.8)
 *
 * Shopper payments a suspended store opened that no webhook or enquiry has
 * settled after 48 h (`platformStalePendingPayments`, billing:read), oldest
 * first: ids, provider, amount and dates only, never shopper data. Billing
 * › Stuck store payments lists every suspended store; the store page lists
 * one store (`tenantId`), e.g. right after a reactivation. When a store's
 * database couldn't be read the server says `partial`.
 */

import { useQuery } from "@apollo/client";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { Link } from "react-router-dom";
import { PLATFORM_STALE_PENDING_PAYMENTS } from "../../graphql/billing";
import { getAppProviderLabel } from "../../lib/display-labels.util";
import { formatDate, formatDateTime } from "../../lib/utils";
import type { StalePendingPaymentList } from "../../types/platform-api";
import { compactTableClassNames } from "../common/dataTableStyles";
import { CopyableId, EmptyState, ErrorState, Skeleton, cx, formatMoney, toneTextClasses } from "../ui";
import { IconPayments } from "../ui/icons";

/** The server's default page; it caps a page at 200. */
const STALE_PAYMENTS_LIMIT = 50;

export interface StalePendingPaymentsProps {
  /** One store (ACTIVE or SUSPENDED); omit for every suspended store. */
  tenantId?: string;
}

export function StalePendingPayments({ tenantId }: StalePendingPaymentsProps) {
  const query = useQuery<{ platformStalePendingPayments: StalePendingPaymentList }>(
    PLATFORM_STALE_PENDING_PAYMENTS,
    {
      variables: { tenantId: tenantId ?? null, limit: STALE_PAYMENTS_LIMIT },
      fetchPolicy: "cache-and-network",
    },
  );
  const list = query.data?.platformStalePendingPayments;

  if (!list) {
    if (query.error) {
      return (
        <ErrorState title="Couldn't read the pending payments." onRetry={() => void query.refetch()} />
      );
    }
    return (
      <div className="space-y-2 p-4" role="status" aria-label="Loading the pending payments">
        <Skeleton className="h-5 w-full rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
      </div>
    );
  }

  return (
    <div>
      {list.partial ? (
        <p role="note" className={cx("px-4 pt-3 text-label", toneTextClasses.warning)}>
          Some stores couldn't be read; their payments are missing from this list.
        </p>
      ) : null}
      <Table aria-label="Payments pending for more than 48 hours" removeWrapper classNames={compactTableClassNames}>
        <TableHeader>
          <TableColumn>{tenantId ? "Payment" : "Store"}</TableColumn>
          <TableColumn>{tenantId ? "Order" : "Payment"}</TableColumn>
          <TableColumn>Provider</TableColumn>
          <TableColumn align="end">Amount</TableColumn>
          <TableColumn>Opened</TableColumn>
          <TableColumn>Last enquiry</TableColumn>
        </TableHeader>
        <TableBody
          items={list.items}
          emptyContent={
            <EmptyState
              icon={IconPayments}
              title="No stuck payments"
              description="Every payment opened more than 48 hours ago has settled."
            />
          }
        >
          {(row) => (
            <TableRow key={`${row.tenantId}:${row.paymentId}`}>
              <TableCell>
                {tenantId ? (
                  <CopyableId value={row.paymentId} />
                ) : (
                  <Link to={`/stores/${row.tenantId}`} className="font-medium text-fg hover:underline">
                    {row.tenantName}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                {tenantId ? (
                  row.orderId ? <CopyableId value={row.orderId} /> : <span className="text-fg-subtle">—</span>
                ) : (
                  <CopyableId value={row.paymentId} />
                )}
              </TableCell>
              <TableCell>
                {row.provider ? getAppProviderLabel(row.provider) : <span className="text-fg-subtle">—</span>}
              </TableCell>
              <TableCell>
                <span className="block text-right num">
                  {formatMoney(row.amount, { currency: row.currency ?? "INR", paise: true })}
                </span>
              </TableCell>
              <TableCell>
                <span className="num">{formatDateTime(row.createdAt)}</span>
              </TableCell>
              <TableCell>
                {row.lastEnquiryAt ? (
                  <span className="num">{formatDate(row.lastEnquiryAt)}</span>
                ) : (
                  <span className="text-fg-subtle">Never</span>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
