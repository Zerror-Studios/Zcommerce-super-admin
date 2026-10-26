/**
 * Invoice pieces shared by Billing › Invoices and the store's Billing
 * section (PRD-016 FR-20, PRD-017 FR-4.3): the status chip (with the
 * derived "Partially paid"), the reason label (period, proration, restart)
 * and the detail dialog with the server's line amounts. Every amount is
 * the server's.
 */

import { invoiceReasonLabel, invoiceStatusView } from "../../lib/platform-billing.util";
import { getPlanLabel } from "../../lib/display-labels.util";
import type { PlatformInvoice } from "../../types/platform-api";
import {
  Button as UiButton,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  formatDate,
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
