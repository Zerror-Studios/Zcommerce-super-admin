import { useMemo } from "react";
import type { Transaction, TransactionStatus } from "../../types";
import { getPaymentGatewayLabel, getPlanLabel } from "../../lib/display-labels.util";
import { joinParam, splitParam } from "../../lib/store-table.util";
import { useClients } from "../../providers/ClientsProvider";
import { useUrlSearch } from "../../hooks/use-url-search";
import { formatDateTime } from "../../lib/utils";
import { AppliedFilters } from "../common/AppliedFilters";
import { FilterEmpty } from "../common/FilterEmpty";
import { FilterCheckboxGroup, TableToolbar } from "../common/TableToolbar";
import {
  CopyableId,
  DataTable,
  EmptyState,
  StatusChip,
  TablePagination,
  formatMoney,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import { IconPayments } from "../ui/icons";

export interface TransactionsTabProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const columnOptions: DataTableColumn[] = [
  { key: "date", label: "Date & time" },
  { key: "clientName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "amount", label: "Amount", align: "end" },
  { key: "status", label: "Status" },
  { key: "gateway", label: "Gateway" },
  { key: "transactionId", label: "Transaction ID" },
];

/** Filter options use the same labels as the status badges (Paid / Due / Failed / Refunded). */
const statusOptions: { key: TransactionStatus; label: string }[] = [
  { key: "success", label: "Paid" },
  { key: "pending", label: "Due" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

/**
 * Subscriptions › Transactions (docs/design/04-super-admin.md §3.6): the kit table, 50 per page over the
 * 200 newest payments; search, status filter and page in the URL; Columns remembered.
 */
export function TransactionsTab({ transactions, isLoading = false }: TransactionsTabProps) {
  const { clients } = useClients();
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const statuses = splitParam(table.filters.status);
  const [visibleColumns, setVisibleColumns] = usePersistentColumns(
    "transactions",
    columnOptions.map((c) => c.key),
  );

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const statusKey = statuses.join();
  const filtered = useMemo(() => {
    const query = table.search.trim().toLowerCase();
    const wanted = statusKey ? statusKey.split(",") : [];
    return transactions.filter((txn) => {
      const client = clientById.get(txn.clientId);
      const email = client?.ownerEmail ?? "";
      const plan = client?.plan ?? "";
      const matchesSearch =
        !query ||
        txn.clientName.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        plan.toLowerCase().includes(query) ||
        txn.transactionId.toLowerCase().includes(query);
      const matchesStatus = wanted.length === 0 || wanted.includes(txn.status);
      return matchesSearch && matchesStatus;
    });
  }, [table.search, statusKey, transactions, clientById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / table.pageSize));
  const page = Math.min(table.page, pageCount);
  const pageRows = filtered.slice((page - 1) * table.pageSize, page * table.pageSize);

  const isFiltered = table.search.trim() !== "" || statuses.length > 0;
  const clearFilters = () => {
    setSearch("");
    table.clearFilters();
  };

  const renderCell = (txn: Transaction, key: string) => {
    const client = clientById.get(txn.clientId);
    switch (key) {
      case "date":
        return <span className="whitespace-nowrap num">{formatDateTime(txn.date)}</span>;
      case "clientName":
        return (
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap font-medium text-fg">{txn.clientName}</p>
            <p className="truncate text-caption text-fg-subtle">{client?.ownerEmail ?? "—"}</p>
          </div>
        );
      case "plan":
        return client?.plan ? (
          <span className="text-fg">{getPlanLabel(client.plan)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      case "amount":
        return <span className="num">{formatMoney(txn.amount, { currency: txn.currency, paise: true })}</span>;
      case "status":
        return <StatusChip domain="payment" status={txn.status} />;
      case "gateway":
        return getPaymentGatewayLabel(txn.gateway);
      case "transactionId":
        return <CopyableId value={txn.transactionId} className="text-label" />;
      default:
        return <span className="text-fg-subtle">—</span>;
    }
  };

  const toolbar = (
    <>
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search transactions"
        columns={columnOptions.map((c) => ({ key: c.key, label: String(c.label) }))}
        visibleColumns={Array.from(visibleColumns)}
        onVisibleColumnsChange={(keys) => setVisibleColumns(new Set(keys))}
        filterContent={
          <FilterCheckboxGroup
            label="Status"
            options={statusOptions}
            value={statuses}
            onChange={(value) => table.setFilter("status", joinParam(value))}
          />
        }
      />
      <AppliedFilters
        items={statuses.map((status) => ({
          key: status,
          label: `Status: ${statusOptions.find((o) => o.key === status)?.label ?? status}`,
          onRemove: () => table.setFilter("status", joinParam(statuses.filter((s) => s !== status))),
        }))}
        onClearAll={clearFilters}
      />
    </>
  );

  return (
    <DataTable
      aria-label="Transactions"
      columns={columnOptions}
      visibleColumns={visibleColumns}
      rows={pageRows}
      getRowKey={(txn) => txn.id}
      renderCell={renderCell}
      isLoading={isLoading}
      toolbar={toolbar}
      stickyFirstColumn
      scrollClassName="max-h-[70vh]"
      footer={
        <TablePagination
          page={page}
          pageSize={table.pageSize}
          total={filtered.length}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      }
      emptyContent={
        isFiltered ? (
          <FilterEmpty things="transactions" query={table.search} onClear={clearFilters} />
        ) : (
          <EmptyState
            icon={IconPayments}
            title="No transactions yet"
            description="Payments from Stripe and Razorpay appear here once stores are billed."
          />
        )
      }
    />
  );
}
