import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useMemo, useState } from "react";
import type { Transaction, TransactionStatus } from "../../types";
import { getPaymentGatewayLabel, getPlanLabel } from "../../lib/display-labels.util";
import { useClients } from "../../providers/ClientsProvider";
import { formatDateTime } from "../../lib/utils";
import { dataTableFillClassNames, tablePanelFillClassName } from "../common/dataTableStyles";
import {
  FilterCheckboxGroup,
  TableToolbar,
} from "../common/TableToolbar";
import {
  Button as UiButton,
  CopyableId,
  EmptyState,
  StatusChip,
  formatMoney,
  Skeleton,
  tableRowClasses,
} from "../ui";
import { IconPayments } from "../ui/icons";
import { emptyStates } from "../../copy";
import { LoadMoreFooter, type LoadMoreFooterProps } from "../common/LoadMoreFooter";

export interface TransactionsTabProps {
  transactions: Transaction[];
  isLoading?: boolean;
  /** Server paging (FE-09): search and filters cover the loaded rows. */
  paging?: Omit<LoadMoreFooterProps, "shown" | "noun">;
}

const columnOptions = [
  { key: "date", label: "Date & time" },
  { key: "clientName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "amount", label: "Amount" },
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

export function TransactionsTab({ transactions, isLoading = false, paging }: TransactionsTabProps) {
  const { clients } = useClients();
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState(
    columnOptions.map((c) => c.key),
  );

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
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
      const matchesStatus =
        statuses.length === 0 || statuses.includes(txn.status);
      return matchesSearch && matchesStatus;
    });
  }, [search, statuses, transactions, clientById]);

  const headerColumns = columnOptions.filter((c) => visibleColumns.includes(c.key));
  const isFiltered = search.trim() !== "" || statuses.length > 0;

  const renderCell = (txn: Transaction, key: string) => {
    const client = clientById.get(txn.clientId);
    switch (key) {
      case "date":
        return <span className="whitespace-nowrap num">{formatDateTime(txn.date)}</span>;
      case "clientName":
        return (
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap font-medium text-fg">{txn.clientName}</p>
            <p className="truncate text-caption text-fg-subtle">
              {client?.ownerEmail ?? "—"}
            </p>
          </div>
        );
      case "plan":
        return client?.plan ? (
          <span className="text-fg">{getPlanLabel(client.plan)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      case "amount":
        return (
          <span className="block text-right num">
            {formatMoney(txn.amount, { currency: txn.currency, paise: true })}
          </span>
        );
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

  return (
    <div className={tablePanelFillClassName}>
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search transactions"
        columns={columnOptions}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
        filterContent={
          <FilterCheckboxGroup
            label="Status"
            options={statusOptions}
            value={statuses}
            onChange={setStatuses}
          />
        }
      />

      <Table
        aria-label="Transactions"
        classNames={{ ...dataTableFillClassNames, tr: tableRowClasses }}
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn key={column.key} align={column.key === "amount" ? "end" : "start"}>
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          isLoading={isLoading}
          loadingContent={<Skeleton className="h-10 w-full rounded-lg" />}
          items={filtered}
          emptyContent={
            isFiltered ? (
              <EmptyState
                icon={IconPayments}
                title={search.trim() ? emptyStates.noResults(search.trim()).title : "No transactions match these filters"}
                description={emptyStates.noResults("").description}
                action={
                  <UiButton
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setSearch("");
                      setStatuses([]);
                    }}
                  >
                    {emptyStates.noResults("").action}
                  </UiButton>
                }
              />
            ) : (
              <EmptyState
                icon={IconPayments}
                title="No transactions yet"
                description="Payments from Stripe and Razorpay appear here once stores are billed."
              />
            )
          }
        >
          {(txn) => (
            <TableRow key={txn.id}>
              {(columnKey) => (
                <TableCell>{renderCell(txn, String(columnKey))}</TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
      {paging ? <LoadMoreFooter {...paging} shown={transactions.length} noun="payments" /> : null}
    </div>
  );
}
