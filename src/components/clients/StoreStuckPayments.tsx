/**
 * One store's shopper payments still pending after 48 hours (PRD-018 FR-1.8; 04 S-03i change 2): ids, provider,
 * amount and dates only, never shopper data. Store detail › Lifecycle lists them; Billing & plan reads the count
 * for its notice (the same query, so Apollo asks once). Needs `platform:billing:read`.
 *
 * Table widths fit the 724px content column: Payment (flex) | Order 110 | Provider 110 | Amount 100 | Opened 150
 * ("last enquiry …" as the second line). Fixed 470 → Payment 254px.
 */
import { useQuery } from "@apollo/client";
import { PLATFORM_STALE_PENDING_PAYMENTS } from "../../graphql/billing";
import { getAppProviderLabel } from "../../lib/display-labels.util";
import type { StalePendingPaymentList } from "../../types/platform-api";
import { TableCardHeader } from "../settings/TableCardHeader";
import { Card, CopyableId, DataTable, EmptyState, ErrorState, formatDate, formatDateTime, formatMoney, type DataTableColumn } from "../ui";
import { IconPayments } from "../ui/icons";
import { InlineNotice } from "./StoreDetailParts";

/** The server's default page; it caps a page at 200. */
const STALE_PAYMENTS_LIMIT = 50;

export function useStoreStuckPayments(tenantId: string, skip = false) {
  return useQuery<{ platformStalePendingPayments: StalePendingPaymentList }>(PLATFORM_STALE_PENDING_PAYMENTS, {
    variables: { tenantId, limit: STALE_PAYMENTS_LIMIT },
    fetchPolicy: "cache-and-network",
    skip,
  });
}

const columns: DataTableColumn[] = [
  { key: "payment", label: "Payment", mobile: "primary" },
  { key: "order", label: "Order", width: 110 },
  { key: "provider", label: "Provider", width: 110 },
  { key: "amount", label: "Amount", width: 100 },
  { key: "opened", label: "Opened", width: 150 },
];

export function StoreStuckPayments({ tenantId }: { tenantId: string }) {
  const query = useStoreStuckPayments(tenantId);
  const list = query.data?.platformStalePendingPayments;
  const header = (
    <TableCardHeader
      title="Payments pending over 48 hours"
      description="Shopper payments no webhook or enquiry has settled yet. They settle on their own once the provider answers."
    />
  );

  if (!list && query.error) {
    return (
      <Card padding="none" className="overflow-clip">
        {header}
        <ErrorState inline title="Couldn't read the pending payments." onRetry={() => void query.refetch()} />
      </Card>
    );
  }

  return (
    <DataTable
      aria-label="Payments pending for more than 48 hours"
      columns={columns}
      rows={list?.items ?? []}
      getRowKey={(row) => row.paymentId}
      isLoading={!list && query.loading}
      rowHeight="tall"
      toolbar={
        <>
          {header}
          {list?.partial ? (
            <InlineNotice className="mx-5 my-3">Some payments couldn't be read; they are missing from this list.</InlineNotice>
          ) : null}
        </>
      }
      renderCell={(row, key) => {
        switch (key) {
          case "payment":
            return <CopyableId value={row.paymentId} />;
          case "order":
            return row.orderId ? <CopyableId value={row.orderId} /> : <span className="text-fg-subtle">None</span>;
          case "provider":
            return row.provider ? getAppProviderLabel(row.provider) : <span className="text-fg-subtle">Unknown</span>;
          case "amount":
            return <span className="num">{formatMoney(row.amount, { currency: row.currency ?? "INR" })}</span>;
          case "opened":
            return (
              <span className="block">
                <span className="block num">{formatDateTime(row.createdAt)}</span>
                <span className="block text-label text-fg-muted">
                  {row.lastEnquiryAt ? `last enquiry ${formatDate(row.lastEnquiryAt)}` : "never enquired"}
                </span>
              </span>
            );
          default:
            return null;
        }
      }}
      emptyContent={
        <EmptyState
          icon={IconPayments}
          title="No stuck payments"
          description="Every payment opened more than 48 hours ago has settled."
        />
      }
    />
  );
}
