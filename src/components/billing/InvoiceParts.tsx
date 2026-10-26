/**
 * Invoice pieces shared by Billing › Invoices and the store's Billing
 * section (PRD-016 FR-20, PRD-017 FR-4.3): the status chip (with the
 * derived "Partially paid"), the reason label (period, proration, restart)
 * and the detail dialog with the server's line amounts. Every amount is
 * the server's. Since PRD-024 FR-3.8 the dialog also reads the invoice's
 * status history and linked payments when it opens.
 */

import { useInvoiceDetail } from "../../hooks/use-platform-reports";
import { invoiceReasonLabel, invoiceStatusView } from "../../lib/platform-billing.util";
import { getPlanLabel } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { invoiceActorLabel, invoiceHistoryLabel } from "../../lib/platform-history.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformInvoice } from "../../types/platform-api";
import {
  Button as UiButton,
  Chip,
  ErrorState,
  Skeleton,
  StatusChip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  formatDate,
  formatDateTime,
  formatMoney,
} from "../ui";

export function InvoiceStatusChip({ invoice }: { invoice: PlatformInvoice }) {
  const view = invoiceStatusView(invoice);
  return <Chip tone={view.tone}>{view.label}</Chip>;
}

export interface InvoiceDetailModalProps {
  invoice: PlatformInvoice | null;
  onClose: () => void;
}

export function InvoiceDetailModal({ invoice, onClose }: InvoiceDetailModalProps) {
  if (!invoice) return null;
  const money = (amount: number) => formatMoney(amount, { currency: invoice.currency, paise: true });
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Plan price", value: money(invoice.amount) },
    ...(invoice.discount > 0
      ? [{ label: `Discount${invoice.couponCode ? ` (${invoice.couponCode})` : ""}`, value: `− ${money(invoice.discount)}` }]
      : []),
    ...(invoice.tax > 0 ? [{ label: "Tax", value: money(invoice.tax) }] : []),
    { label: "Total", value: money(invoice.total), strong: true },
    ...(invoice.creditApplied > 0 ? [{ label: "Credit applied", value: `− ${money(invoice.creditApplied)}` }] : []),
    { label: "Paid", value: money(invoice.amountPaid) },
    { label: "Still owed", value: money(invoice.amountDue), strong: true },
  ];
  return (
    <Modal isOpen onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>Invoice {invoice.number}</ModalHeader>
        <ModalBody>
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceStatusChip invoice={invoice} />
            <Chip tone="neutral" dot={false}>
              {invoiceReasonLabel(invoice)}
            </Chip>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-body">
            <dt className="text-fg-muted">Store</dt>
            <dd className="text-fg">{invoice.tenantName}</dd>
            <dt className="text-fg-muted">Plan</dt>
            <dd className="text-fg">
              {getPlanLabel(invoice.planName)}, {invoice.billingCycle === "YEARLY" ? "yearly" : "monthly"}
            </dd>
            <dt className="text-fg-muted">Period</dt>
            <dd className="text-fg">
              {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
            </dd>
            <dt className="text-fg-muted">Issued</dt>
            <dd className="text-fg">{formatDate(invoice.issuedAt)}</dd>
            <dt className="text-fg-muted">Due</dt>
            <dd className="text-fg">{formatDate(invoice.dueAt)}</dd>
            {invoice.paidAt ? (
              <>
                <dt className="text-fg-muted">Paid on</dt>
                <dd className="text-fg">{formatDate(invoice.paidAt)}</dd>
              </>
            ) : null}
            {invoice.voidReason ? (
              <>
                <dt className="text-fg-muted">Void reason</dt>
                <dd className="text-fg">{invoice.voidReason}</dd>
              </>
            ) : null}
          </dl>
          <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-body">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className={row.strong ? "font-medium text-fg" : "text-fg-muted"}>{row.label}</dt>
                <dd className={`num ${row.strong ? "font-medium text-fg" : "text-fg"}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <InvoiceHistory invoice={invoice} />
        </ModalBody>
        <ModalFooter>
          <UiButton variant="primary" onPress={onClose}>
            Close
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * PRD-024 FR-3.8 (P-07): who moved the invoice to each status and when,
 * and the payment rows linked to it (payments, flagged, refunds).
 */
function InvoiceHistory({ invoice }: { invoice: PlatformInvoice }) {
  const { can } = useAuth();
  const detail = useInvoiceDetail(invoice);
  // Mirror of the server guard (billing:read); without it there is nothing to show.
  if (!can(PLATFORM_PERMISSIONS.BILLING_READ)) return null;
  if (detail.error) {
    return (
      <div className="mt-4 border-t border-line pt-3">
        <ErrorState inline title="Couldn't load the invoice history." onRetry={() => void detail.refetch()} />
      </div>
    );
  }
  if (detail.loading) {
    return (
      <div className="mt-4 border-t border-line pt-3" role="status" aria-label="Loading invoice history">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }
  const history = detail.data?.statusHistory ?? [];
  const payments = detail.data?.payments ?? [];
  return (
    <>
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-label font-medium text-fg">Status history</p>
        {history.length === 0 ? (
          <p className="mt-1 text-caption text-fg-muted">No status changes recorded.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5 text-body">
            {history.map((change, index) => (
              <li key={`${change.status}-${change.at}-${index}`} className="flex flex-wrap justify-between gap-x-4">
                <span className="text-fg">{invoiceHistoryLabel(change.status)}</span>
                <span className="text-caption text-fg-muted">
                  {formatDateTime(change.at)} · {invoiceActorLabel(change.actor)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-label font-medium text-fg">Payments</p>
        {payments.length === 0 ? (
          <p className="mt-1 text-caption text-fg-muted">No payments linked to this invoice.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-body">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="num text-fg">
                    {formatMoney(payment.amount, { currency: payment.currency, paise: true })}
                    <span className="text-fg-muted"> · {payment.provider}</span>
                    {payment.type === "REFUND" ? <span className="text-fg-muted"> · refund</span> : null}
                  </p>
                  <p className="truncate text-caption text-fg-subtle">
                    {payment.createdAt ? formatDateTime(payment.createdAt) : "—"}
                    {payment.transactionId ? ` · ${payment.transactionId}` : ""}
                    {payment.failureReason ? ` · ${payment.failureReason}` : ""}
                  </p>
                </div>
                {payment.flagged ? (
                  <Chip tone="warning">Flagged</Chip>
                ) : (
                  <StatusChip domain="payment" status={payment.status.toLowerCase()} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
