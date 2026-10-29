/**
 * Billing › Invoices (PRD-017 FR-4.3)
 *
 * `platformInvoices` with the status, due-date and search filters applied
 * on the server, read 100 at a time past the backend cap (FE-09 rule). A
 * row opens the detail dialog; open invoices keep the existing actions
 * (record payment, discount, void), each confirmed and followed by a
 * re-read. Status history needs a contract field that doesn't exist yet.
 */

import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useInvoices } from "../../hooks/use-platform-reports";
import { invoiceReasonLabel, toInvoiceActionRow } from "../../lib/platform-billing.util";
import type { PlatformInvoice, PlatformInvoiceFilter, PlatformInvoiceStatus } from "../../types/platform-api";
import { AppliedFilters, type AppliedFilterItem } from "../common/AppliedFilters";
import { dataTableFillClassNames, tablePanelFillClassName } from "../common/dataTableStyles";
import { DateRangeComparison, type DateRangeValue } from "../common/DateRangeComparison";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { PageHeader } from "../common/PageHeader";
import { TableToolbar } from "../common/TableToolbar";
import {
  EmptyState,
  ErrorState,
  Select,
  SelectItem,
  Skeleton,
  formatDate,
  formatMoney,
  tableRowClasses,
} from "../ui";
import { IconInvoice } from "../ui/icons";

/** The Status select's "All statuses" option (no status filter). */
const ALL = "__all";
import { InvoiceDetailModal, InvoiceStatusChip } from "./InvoiceParts";
import { InvoiceRowActions } from "./InvoiceRowActions";

const STATUS_OPTIONS: { key: PlatformInvoiceStatus; label: string }[] = [
  { key: "ISSUED", label: "Due" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "PAID", label: "Paid" },
  { key: "VOID", label: "Void" },
  { key: "REFUNDED", label: "Refunded" },
];

const columns = [
  { key: "number", label: "Invoice" },
  { key: "store", label: "Store" },
  { key: "reason", label: "Type" },
  { key: "total", label: "Total", end: true },
  { key: "due", label: "Still owed", end: true },
  { key: "status", label: "Status" },
  { key: "dueAt", label: "Due date" },
  { key: "actions", label: "", end: true },
];

const isStatus = (value: string | null): value is PlatformInvoiceStatus =>
  STATUS_OPTIONS.some((option) => option.key === value);
const isDay = (value: string | null): value is string => value != null && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** `YYYY-MM-DD` from the date input → an ISO day bound for the filter. */
function dayBound(value: string, end: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return end ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}

export function InvoicesTab() {
  const [search, setSearch] = useState("");
  // Owner 2026-10-28: Status in the Filter popover (like Collections), the due date in the header's date picker.
  // 2026-10-29: both live in the URL (?status=OVERDUE&from=2026-10-01&to=2026-10-31), so the Collections
  // figures link straight to the invoices behind them, and a filtered view survives refresh.
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status: PlatformInvoiceStatus | null = isStatus(statusParam) ? statusParam : null;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const dueFrom = isDay(fromParam) && isDay(toParam) ? fromParam : "";
  const dueTo = isDay(fromParam) && isDay(toParam) ? toParam : "";
  const due = useMemo<DateRangeValue | null>(
    () => (dueFrom && dueTo ? { startDate: startOfDay(parseISO(dueFrom)), endDate: endOfDay(parseISO(dueTo)) } : null),
    [dueFrom, dueTo],
  );
  const setParam = (patch: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      },
      { replace: true },
    );
  const setStatus = (value: PlatformInvoiceStatus | null) => setParam({ status: value });
  const setDue = (value: DateRangeValue | null) =>
    setParam({
      from: value ? format(value.startDate, "yyyy-MM-dd") : null,
      to: value ? format(value.endDate, "yyyy-MM-dd") : null,
    });
  const [open, setOpen] = useState<PlatformInvoice | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const filter = useMemo<PlatformInvoiceFilter | null>(() => {
    const next: PlatformInvoiceFilter = {
      search: debouncedSearch || null,
      status: status ? [status] : null,
      dueFrom: dayBound(dueFrom, false),
      dueTo: dayBound(dueTo, true),
    };
    return Object.values(next).some((value) => value != null) ? next : null;
  }, [debouncedSearch, dueFrom, dueTo, status]);
  // Seeds the calendar while no due date is picked.
  const thisMonth = useMemo<DateRangeValue>(
    () => ({ startDate: startOfMonth(new Date()), endDate: endOfDay(endOfMonth(new Date())) }),
    [],
  );
  const applied: AppliedFilterItem[] = status
    ? [
        {
          key: "status",
          label: `Status: ${STATUS_OPTIONS.find((option) => option.key === status)?.label ?? status}`,
          onRemove: () => setStatus(null),
        },
      ]
    : [];

  const invoices = useInvoices(filter);

  const renderCell = (invoice: PlatformInvoice, key: string) => {
    const money = (amount: number) => formatMoney(amount, { currency: invoice.currency, paise: true });
    switch (key) {
      case "number":
        return <span className="num whitespace-nowrap font-medium text-fg">{invoice.number}</span>;
      case "store":
        return <span className="truncate text-fg">{invoice.tenantName}</span>;
      case "reason":
        return invoiceReasonLabel(invoice);
      case "total":
        return <span className="num">{money(invoice.total)}</span>;
      case "due":
        return invoice.amountDue > 0 ? <span className="num">{money(invoice.amountDue)}</span> : <span className="text-fg-subtle">—</span>;
      case "status":
        return <InvoiceStatusChip invoice={invoice} />;
      case "dueAt":
        return <span className="whitespace-nowrap">{formatDate(invoice.dueAt)}</span>;
      case "actions":
        return <InvoiceRowActions row={toInvoiceActionRow(invoice)} onChanged={invoices.refetch} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconInvoice aria-hidden />}
        section="green"
        title="Invoices"
        description="Every invoice Zcommerce issued to a store, newest first."
        actions={
          <DateRangeComparison
            value={due ?? thisMonth}
            onChange={setDue}
            anyLabel="Any due date"
            isAny={!due}
            onClear={() => setDue(null)}
            maxDate={null}
            compare={false}
          />
        }
      />
      <div className={tablePanelFillClassName}>
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by invoice number or store"
          filterContent={
            <Select
              label="Status"
              size="sm"
              selectedKeys={new Set([status ?? ALL])}
              onSelectionChange={(keys) => {
                const next = String(Array.from(keys)[0] ?? ALL);
                setStatus(next === ALL ? null : (next as PlatformInvoiceStatus));
              }}
              disallowEmptySelection
              items={[{ key: ALL, label: "All statuses" }, ...STATUS_OPTIONS]}
            >
              {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
            </Select>
          }
        />
        <AppliedFilters items={applied} onClearAll={() => setStatus(null)} />

        {invoices.error && invoices.data.length === 0 ? (
          <ErrorState title="Couldn't load invoices." onRetry={() => void invoices.refetch()} />
        ) : (
          <Table aria-label="Invoices" classNames={{ ...dataTableFillClassNames, tr: tableRowClasses }}>
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.key} align={column.end ? "end" : "start"}>
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              isLoading={invoices.loading}
              loadingContent={<Skeleton className="h-10 w-full rounded-lg" />}
              items={invoices.data}
              emptyContent={
                <EmptyState
                  icon={IconInvoice}
                  title={filter ? "No invoices match these filters" : "No invoices yet"}
                  description={filter ? "Clear a filter to see more." : "Invoices appear here when stores are billed."}
                />
              }
            >
              {(invoice) => (
                <TableRow key={invoice.id} onClick={() => setOpen(invoice)} className="cursor-pointer">
                  {(columnKey) => <TableCell>{renderCell(invoice, String(columnKey))}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <LoadMoreFooter
          shown={invoices.data.length}
          total={invoices.totalCount}
          hasMore={invoices.hasMore && !invoices.error}
          loading={invoices.loadingMore}
          onLoadMore={invoices.loadMore}
          noun="invoices"
        />
        <InvoiceDetailModal invoice={open} onClose={() => setOpen(null)} />
      </div>
    </div>
  );
}
