/**
 * Billing & plan › Payments, invoices and reminders (04 S-03d): one card with a segmented sm switch (with counts)
 * that holds what the old Subscriptions › Collections, Invoices and Transactions pages showed for this store.
 *
 * - Payments: a second switch filters by status on the server (All · Paid · Failed · Refunded, plus Needs review
 *   when the store has flagged payments). Each payment is an expandable card: invoice, transaction ID, provider,
 *   period and the invoice's amount breakdown; flagged ones carry Apply to invoice / Mark refunded / Dismiss.
 * - Invoices: a table sized for the 724px column (fixed 516 → Invoice 208px); a row opens the Invoice pop-up.
 * - Reminders: the sent reminders, newest first, with Send reminder while a payment is owed.
 */
import { useQuery } from "@apollo/client";
import { useMemo, useState, type ReactNode } from "react";
import { PLATFORM_PAYMENTS } from "../../graphql/billing";
import { useInvoices, useReminderLog } from "../../hooks/use-platform-reports";
import { getPaymentGatewayLabel } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { FLAGGED_REASON_LABELS, invoiceReasonLabel, toInvoiceActionRow } from "../../lib/platform-billing.util";
import { paymentStatusCounts, reminderChannelLabel, reminderOffsetLabel, reminderResultView } from "../../lib/platform-history.util";
import { graceDaysFor } from "../../lib/storeStatus";
import { useAuth } from "../../providers/AuthProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import type { Client, Subscription } from "../../types";
import type { FlaggedPaymentAction, PlatformInvoice, PlatformPayment, PlatformStatusCount } from "../../types/platform-api";
import { InvoiceDetailModal, InvoiceStatusChip } from "../billing/InvoiceParts";
import { InvoiceRowActions } from "../billing/InvoiceRowActions";
import { TableCardHeader } from "../settings/TableCardHeader";
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  CopyableId,
  DataTable,
  EmptyState,
  ErrorState,
  RowMenu,
  SegmentedSwitch,
  Skeleton,
  TablePagination,
  cx,
  formatDate,
  formatDateTime,
  formatMoney,
  toast,
  type DataTableColumn,
  type Tone,
} from "../ui";
import { IconDuplicate, IconInvoice, IconPayments, IconSend, IconView } from "../ui/icons";
import { SendReminderDialog } from "./stores-list/SendReminderDialog";
import { isPaymentOwed, paymentBadge } from "./stores-list/store-list.util";
import { ExpandableCard, InlineNotice, KeyValue, KeyValueGrid } from "./StoreDetailParts";
import { StoreFlaggedPaymentDialog } from "./StoreFlaggedPaymentDialog";
import { useStoreStuckPayments } from "./StoreStuckPayments";
import { useStoreBillingRefresh } from "./useStoreBillingRefresh";

type Tab = "payments" | "invoices" | "reminders";
type PaymentFilter = "all" | "SUCCESS" | "FAILED" | "REFUNDED" | "review";

const PAYMENTS_PAGE = 30;
const REMINDERS_PAGE = 20;

interface PaymentsData {
  platformPayments: { items: PlatformPayment[]; totalCount: number; countsByStatus: PlatformStatusCount[] | null };
}

/** The store's payments under one filter; the All read also carries the counts per status. */
function useStorePayments(tenantId: string, filter: PaymentFilter, limit: number, skip: boolean) {
  const apiFilter =
    filter === "all"
      ? { tenantId }
      : filter === "review"
        ? { tenantId, flagged: true }
        : { tenantId, status: [filter] };
  return useQuery<PaymentsData>(PLATFORM_PAYMENTS, {
    variables: { filter: apiFilter, limit, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip,
  });
}

const PAYMENT_BADGES: Record<PlatformPayment["status"], { label: string; tone: Tone }> = {
  SUCCESS: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  PENDING: { label: "Pending", tone: "info" },
};

function paymentBadgeOf(payment: PlatformPayment): { label: string; tone: Tone } {
  if (payment.flagged && !payment.resolvedAt) return { label: "Needs review", tone: "warning" };
  return PAYMENT_BADGES[payment.status] ?? { label: payment.status, tone: "neutral" };
}

function periodOf(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it instead.");
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

export interface StorePaymentsCardProps {
  client: Client;
  subscription?: Subscription;
  /** Store detail › Lifecycle, which lists the stuck shopper payments. */
  lifecycleHref: string;
}

export function StorePaymentsCard({ client, subscription, lifecycleHref }: StorePaymentsCardProps) {
  const { can } = useAuth();
  const canRead = can(PLATFORM_PERMISSIONS.BILLING_READ);
  const [tab, setTab] = useState<Tab>("payments");
  const [openInvoice, setOpenInvoice] = useState<PlatformInvoice | null>(null);

  // Counts for the switch: each list's total from its own read (Apollo shares them with the tabs).
  const all = useStorePayments(client.id, "all", PAYMENTS_PAGE, !canRead);
  const invoices = useInvoices({ tenantId: client.id }, { skip: !canRead });
  const reminders = useReminderLog({ tenantId: client.id, limit: REMINDERS_PAGE, offset: 0 });

  if (!canRead) {
    return (
      <Card title="Payments, invoices and reminders">
        <p className="text-body text-fg-muted">Your role can't see billing. Ask a platform owner for billing access.</p>
      </Card>
    );
  }

  const switcher = (
    <SegmentedSwitch<Tab>
      size="sm"
      ariaLabel="Payments, invoices or reminders"
      value={tab}
      onChange={setTab}
      items={[
        { value: "payments", label: "Payments", count: all.data?.platformPayments.totalCount ?? null },
        { value: "invoices", label: "Invoices", count: invoices.loading ? null : invoices.totalCount },
        { value: "reminders", label: "Reminders", count: reminders.loading ? null : reminders.totalCount },
      ]}
    />
  );
  const header = <TableCardHeader title="Payments, invoices and reminders" actions={switcher} />;

  return (
    <>
      {tab === "payments" ? (
        <PaymentsTab
          client={client}
          header={header}
          all={all}
          invoices={invoices.data}
          onOpenInvoice={setOpenInvoice}
          lifecycleHref={lifecycleHref}
        />
      ) : tab === "invoices" ? (
        <InvoicesTab client={client} header={header} invoices={invoices} onOpenInvoice={setOpenInvoice} />
      ) : (
        <RemindersTab client={client} subscription={subscription} header={header} />
      )}
      <InvoiceDetailModal invoice={openInvoice} onClose={() => setOpenInvoice(null)} />
    </>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

function PaymentsTab({
  client,
  header,
  all,
  invoices,
  onOpenInvoice,
  lifecycleHref,
}: {
  client: Client;
  header: ReactNode;
  all: ReturnType<typeof useStorePayments>;
  invoices: PlatformInvoice[];
  onOpenInvoice: (invoice: PlatformInvoice) => void;
  lifecycleHref: string;
}) {
  const { can } = useAuth();
  const canResolve = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const refresh = useStoreBillingRefresh();
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [limit, setLimit] = useState(PAYMENTS_PAGE);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ payment: PlatformPayment; action: FlaggedPaymentAction } | null>(null);

  const flagged = useStorePayments(client.id, "review", PAYMENTS_PAGE, false);
  const filtered = useStorePayments(client.id, filter, limit, filter === "all" && limit === PAYMENTS_PAGE);
  const query = filter === "all" && limit === PAYMENTS_PAGE ? all : filtered;
  const page = query.data?.platformPayments;
  const rows = page?.items ?? [];
  const counts = paymentStatusCounts(all.data?.platformPayments.countsByStatus);
  const reviewCount = flagged.data?.platformPayments.totalCount ?? 0;
  const stuck = useStoreStuckPayments(client.id);
  const stuckCount = stuck.data?.platformStalePendingPayments.items.length ?? 0;
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);

  const filterItems = [
    { value: "all" as const, label: "All", count: all.data?.platformPayments.totalCount ?? null },
    { value: "SUCCESS" as const, label: "Paid", count: all.data ? counts.success : null },
    { value: "FAILED" as const, label: "Failed", count: all.data ? counts.failed : null },
    { value: "REFUNDED" as const, label: "Refunded", count: all.data ? counts.refunded : null },
    ...(reviewCount > 0 || filter === "review" ? [{ value: "review" as const, label: "Needs review", count: reviewCount }] : []),
  ];

  const resolved = async () => {
    await Promise.all([refresh(), flagged.refetch().catch(() => undefined)]);
  };

  let body: ReactNode;
  if (query.error && !page) {
    body = <ErrorState inline title="Couldn't load the payments." onRetry={() => void query.refetch()} />;
  } else if (!page) {
    body = (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading the payments">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-tile" />
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    body =
      filter === "all" ? (
        <EmptyState compact icon={IconPayments} title="No payments yet" description="Payments for this store show here." />
      ) : (
        <EmptyState compact kind="no-results" icon={IconPayments} title="No payments match" description="Pick another status to see more." />
      );
  } else {
    body = (
      <div className={cx("flex flex-col gap-2", query.loading && "opacity-60")}>
        {rows.map((payment) => (
          <PaymentCard
            key={payment.id}
            payment={payment}
            invoice={payment.invoiceId ? invoiceById.get(payment.invoiceId) : undefined}
            isExpanded={expanded === payment.id}
            onToggle={() => setExpanded((current) => (current === payment.id ? null : payment.id))}
            onOpenInvoice={onOpenInvoice}
            onResolve={canResolve ? (action) => setResolving({ payment, action }) : undefined}
          />
        ))}
        {page.totalCount > rows.length ? (
          <div className="flex items-center justify-between gap-3 pt-2 text-label text-fg-muted">
            <span className="num">
              Showing {rows.length} of {page.totalCount}
            </span>
            <Button variant="secondary" size="sm" isLoading={query.loading} onPress={() => setLimit((current) => current + PAYMENTS_PAGE)}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card padding="none" className="overflow-clip">
      {header}
      <div className="flex flex-col gap-3 p-5">
        <SegmentedSwitch<PaymentFilter>
          size="sm"
          ariaLabel="Payment status"
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setLimit(PAYMENTS_PAGE);
            setExpanded(null);
          }}
          items={filterItems}
        />
        {stuckCount > 0 ? (
          <InlineNotice
            action={
              <ButtonLink to={lifecycleHref} variant="tertiary" size="sm">
                View in Lifecycle ›
              </ButtonLink>
            }
          >
            {stuckCount === 1
              ? "1 shopper payment has been pending for over 48 hours"
              : `${stuckCount} shopper payments have been pending for over 48 hours`}
          </InlineNotice>
        ) : null}
        {body}
      </div>
      <StoreFlaggedPaymentDialog target={resolving} onClose={() => setResolving(null)} onResolved={resolved} />
    </Card>
  );
}

function PaymentCard({
  payment,
  invoice,
  isExpanded,
  onToggle,
  onOpenInvoice,
  onResolve,
}: {
  payment: PlatformPayment;
  invoice?: PlatformInvoice;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenInvoice: (invoice: PlatformInvoice) => void;
  onResolve?: (action: FlaggedPaymentAction) => void;
}) {
  const money = (amount: number) => formatMoney(amount, { currency: payment.currency });
  const badge = paymentBadgeOf(payment);
  const provider = getPaymentGatewayLabel(payment.provider);
  const date = payment.createdAt ? formatDate(payment.createdAt) : null;
  const period = periodOf(payment.periodStart, payment.periodEnd);
  const needsReview = !!payment.flagged && !payment.resolvedAt;
  const reason = payment.failureReason ? (FLAGGED_REASON_LABELS[payment.failureReason] ?? payment.failureReason) : null;

  const details = [
    `Amount: ${money(payment.amount)}`,
    date ? `Date: ${date}` : null,
    `Status: ${badge.label}`,
    invoice ? `Invoice: ${invoice.number}` : null,
    payment.transactionId ? `Transaction ID: ${payment.transactionId}` : null,
    `Paid via: ${provider}`,
    period ? `Period: ${period}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <ExpandableCard
      label={`${money(payment.amount)}${date ? ` on ${date}` : ""}, ${badge.label}`}
      isExpanded={isExpanded}
      onToggle={onToggle}
      summary={
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-body text-fg-muted">
            <span className="text-body-strong text-fg num">{money(payment.amount)}</span>
            {date ? <span className="num"> · {date}</span> : null}
            {` · ${provider}`}
          </span>
          <Chip tone={badge.tone}>{badge.label}</Chip>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {reason && (needsReview || payment.status === "FAILED") ? (
          <p className={cx("text-label", needsReview ? "text-tone-warning" : "text-tone-danger-text")}>{reason}</p>
        ) : null}
        <KeyValueGrid columns={2}>
          <KeyValue label="Invoice">
            {invoice ? (
              <button
                type="button"
                className="font-mono text-label text-brand hover:underline"
                onClick={() => onOpenInvoice(invoice)}
              >
                {invoice.number}
              </button>
            ) : null}
          </KeyValue>
          <KeyValue label="Transaction ID">
            {payment.transactionId ? <CopyableId value={payment.transactionId} className="font-mono text-label" /> : null}
          </KeyValue>
          <KeyValue label="Paid via">{provider}</KeyValue>
          <KeyValue label="Period">{period}</KeyValue>
        </KeyValueGrid>

        {invoice ? (
          <dl className="flex flex-col gap-1.5 rounded-tile bg-surface-sunken px-4 py-3 text-body">
            <AmountRow label="Plan price" value={money(invoice.amount)} />
            <AmountRow
              label={`Discount${invoice.couponCode ? ` (${invoice.couponCode})` : ""}`}
              value={invoice.discount > 0 ? `− ${money(invoice.discount)}` : money(0)}
            />
            <AmountRow label="Credit used" value={invoice.creditApplied > 0 ? `− ${money(invoice.creditApplied)}` : money(0)} />
            <AmountRow label="GST" value={money(invoice.tax)} />
            <AmountRow label="Total" value={money(invoice.total)} strong />
          </dl>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {needsReview && onResolve ? (
            <>
              <Button variant="primary" size="sm" onPress={() => onResolve("APPLY")}>
                Apply to invoice
              </Button>
              <Button variant="secondary" size="sm" onPress={() => onResolve("REFUNDED_OUTSIDE")}>
                Mark refunded
              </Button>
              <Button variant="ghost" size="sm" onPress={() => onResolve("DISMISS")}>
                Dismiss
              </Button>
            </>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            startIcon={<IconDuplicate aria-hidden />}
            onPress={() => void copyText(details, "Payment details copied")}
          >
            Copy payment details
          </Button>
        </div>
      </div>
    </ExpandableCard>
  );
}

function AmountRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-4", strong && "border-t border-line-subtle pt-1.5")}>
      <dt className={strong ? "text-body-strong text-fg" : "text-fg-muted"}>{label}</dt>
      <dd className={cx("num", strong ? "text-body-strong text-fg" : "text-fg")}>{value}</dd>
    </div>
  );
}

// ─── Invoices ────────────────────────────────────────────────────────────────

/** Fixed 516 (+ the 56px ⋯) → Invoice 208px at 724px. */
const invoiceColumns: DataTableColumn[] = [
  { key: "number", label: "Invoice", mobile: "primary" },
  { key: "period", label: "Period", width: 140 },
  { key: "total", label: "Total", width: 100 },
  { key: "due", label: "Still owed", width: 100 },
  { key: "status", label: "Status", width: 120, mobile: "badge", skeleton: "badge" },
  { key: "actions", label: "Actions", width: 56, hideLabel: true, mobile: "hide" },
];

function InvoicesTab({
  client,
  header,
  invoices,
  onOpenInvoice,
}: {
  client: Client;
  header: ReactNode;
  invoices: ReturnType<typeof useInvoices>;
  onOpenInvoice: (invoice: PlatformInvoice) => void;
}) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const refresh = useStoreBillingRefresh();
  const money = (amount: number, currency: string) => formatMoney(amount, { currency });

  if (invoices.error && invoices.data.length === 0) {
    return (
      <Card padding="none" className="overflow-clip">
        {header}
        <ErrorState inline title="Couldn't load the invoices." onRetry={() => void invoices.refetch()} />
      </Card>
    );
  }

  return (
    <DataTable
      aria-label={`Invoices for ${client.storeName}`}
      columns={invoiceColumns}
      rows={invoices.data}
      getRowKey={(invoice) => invoice.id}
      isLoading={invoices.loading}
      rowHeight="tall"
      toolbar={header}
      onRowAction={onOpenInvoice}
      mobileRow={(invoice) => (
        <span className="block">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-label text-fg">{invoice.number}</span>
            <InvoiceStatusChip invoice={invoice} />
          </span>
          <span className="block truncate text-label text-fg-muted">
            {periodOf(invoice.periodStart, invoice.periodEnd)} · {money(invoice.total, invoice.currency)}
          </span>
        </span>
      )}
      renderCell={(invoice, key) => {
        switch (key) {
          case "number":
            return (
              <span className="block min-w-0">
                <span className="block truncate font-mono text-label text-fg">{invoice.number}</span>
                <span className="block truncate text-label text-fg-muted">{invoiceReasonLabel(invoice)}</span>
              </span>
            );
          case "period":
            return <span className="num">{periodOf(invoice.periodStart, invoice.periodEnd)}</span>;
          case "total":
            return <span className="num">{money(invoice.total, invoice.currency)}</span>;
          case "due":
            return invoice.amountDue > 0 ? (
              <span className="num">{money(invoice.amountDue, invoice.currency)}</span>
            ) : (
              <span className="text-fg-subtle num">{money(0, invoice.currency)}</span>
            );
          case "status":
            return <InvoiceStatusChip invoice={invoice} />;
          case "actions": {
            const open = invoice.status === "ISSUED" || invoice.status === "OVERDUE";
            // Open invoices keep the live menu (record a payment, apply a discount, void).
            if (open && canManage) {
              return <InvoiceRowActions row={toInvoiceActionRow(invoice)} onChanged={refresh} />;
            }
            return (
              <RowMenu
                label={`Actions for ${invoice.number}`}
                items={[
                  { key: "view", label: "View invoice", icon: IconView, onSelect: () => onOpenInvoice(invoice) },
                  {
                    key: "copy",
                    label: "Copy invoice number",
                    icon: IconDuplicate,
                    onSelect: () => void copyText(invoice.number, "Invoice number copied"),
                  },
                ]}
              />
            );
          }
          default:
            return null;
        }
      }}
      footer={
        invoices.hasMore ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-4 py-3 text-label text-fg-muted">
            <span className="num">
              Showing {invoices.data.length} of {invoices.totalCount}
            </span>
            <Button variant="secondary" size="sm" isLoading={invoices.loadingMore} onPress={() => void invoices.loadMore()}>
              Load more
            </Button>
          </div>
        ) : undefined
      }
      emptyContent={<EmptyState icon={IconInvoice} title="No invoices yet" description="The first invoice is issued when the trial ends." />}
    />
  );
}

// ─── Reminders ───────────────────────────────────────────────────────────────

function RemindersTab({ client, subscription, header }: { client: Client; subscription?: Subscription; header: ReactNode }) {
  const { can } = useAuth();
  const canRemind = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const { settings } = usePlatformSettings();
  const [page, setPage] = useState(1);
  const [reminding, setReminding] = useState<Client[]>([]);
  // A fresh pop-up per opening (its channel choice and preview start over).
  const [reminderKey, setReminderKey] = useState(0);
  const api = useReminderLog({ tenantId: client.id, limit: REMINDERS_PAGE, offset: (page - 1) * REMINDERS_PAGE });
  const rows = api.data;
  const owed = isPaymentOwed(paymentBadge(subscription, graceDaysFor(client, settings.gracePeriodDays)).kind);

  return (
    <Card padding="none" className="overflow-clip">
      {header}
      {canRemind && owed ? (
        <div className="flex justify-end px-5 pt-4">
          <Button variant="primary" size="sm" startIcon={<IconSend aria-hidden />} onPress={() => {
              setReminderKey((current) => current + 1);
              setReminding([client]);
            }}>
            Send reminder
          </Button>
        </div>
      ) : null}
      {api.error && rows.length === 0 ? (
        <div className="p-5">
          <ErrorState inline title="Couldn't load the sent reminders." onRetry={() => void api.refetch()} />
        </div>
      ) : api.loading ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading sent reminders">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState compact icon={IconSend} title="No reminders sent yet" description="Reminders the schedule or a person sends appear here." />
      ) : (
        <>
          <ul className={cx("mt-2 divide-y divide-line-subtle", api.reloading && "opacity-60")}>
            {rows.map((row) => {
              const result = reminderResultView(row.result);
              const at = row.sentAt ?? row.createdAt;
              return (
                <li key={row.id} className="flex min-h-16 items-center justify-between gap-4 px-5 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-fg">{row.subject}</span>
                    <span className="block truncate text-label text-fg-muted">
                      {reminderChannelLabel(row.channel)} · {reminderOffsetLabel(row.offsetDays)}
                      {row.requestedBy === "job" ? " · scheduled" : " · sent by hand"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="whitespace-nowrap text-label text-fg-muted num">{at ? formatDateTime(at) : ""}</span>
                    <Chip tone={result.tone}>{result.label}</Chip>
                  </span>
                </li>
              );
            })}
          </ul>
          <TablePagination
            page={page}
            pageSize={REMINDERS_PAGE}
            total={api.totalCount}
            onPageChange={setPage}
            isDisabled={api.reloading}
          />
        </>
      )}
      <div className="border-t border-line-subtle px-5 py-3">
        <ButtonLink to="/settings/billing" variant="tertiary" size="sm">
          Reminder rules ›
        </ButtonLink>
      </div>
      <SendReminderDialog
        key={reminderKey}
        stores={reminding}
        onClose={() => {
          setReminding([]);
          void api.refetch();
        }}
      />
    </Card>
  );
}
