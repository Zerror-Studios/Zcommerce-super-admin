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
import { useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useInvoices } from "../../hooks/use-platform-reports";
import { invoiceReasonLabel, toInvoiceActionRow } from "../../lib/platform-billing.util";
import type { PlatformInvoice, PlatformInvoiceFilter, PlatformInvoiceStatus } from "../../types/platform-api";
import { dataTableFillClassNames, tablePanelFillClassName } from "../common/dataTableStyles";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import {
  EmptyState,
  ErrorState,
  Input,
  SearchInput,
  Select,
  SelectItem,
  Skeleton,
  formatDate,
  formatMoney,
  tableRowClasses,
} from "../ui";
import { IconInvoice } from "../ui/icons";
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

/** `YYYY-MM-DD` from the date input → an ISO day bound for the filter. */
function dayBound(value: string, end: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return end ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}

export function InvoicesTab() {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<PlatformInvoiceStatus[]>([]);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [open, setOpen] = useState<PlatformInvoice | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const filter = useMemo<PlatformInvoiceFilter | null>(() => {
    const next: PlatformInvoiceFilter = {
      search: debouncedSearch || null,
      status: statuses.length ? statuses : null,
      dueFrom: dayBound(dueFrom, false),
      dueTo: dayBound(dueTo, true),
    };
    return Object.values(next).some((value) => value != null) ? next : null;
  }, [debouncedSearch, dueFrom, dueTo, statuses]);

  const invoices = useInvoices(filter);

  const renderCell = (invoice: PlatformInvoice, key: string) => {
    const money = (amount: number) => formatMoney(amount, { currency: invoice.currency, paise: true });
    switch (key) {
      case "number":
        return <span className="num font-medium text-fg">{invoice.number}</span>;
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
    <div className={tablePanelFillClassName}>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
        <SearchInput
          aria-label="Search invoices"
          placeholder="Search by invoice number or store"
          value={search}
          onValueChange={setSearch}
          className="w-full max-w-xs"
        />
        <Select
          label="Status"
          selectionMode="multiple"
          selectedKeys={new Set(statuses)}
          onSelectionChange={(keys) => setStatuses(Array.from(keys as Set<string>) as PlatformInvoiceStatus[])}
          className="w-44"
          size="sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Input label="Due from" type="date" size="sm" value={dueFrom} onValueChange={setDueFrom} className="w-40" />
        <Input label="Due to" type="date" size="sm" value={dueTo} onValueChange={setDueTo} className="w-40" />
      </div>

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
  );
}
