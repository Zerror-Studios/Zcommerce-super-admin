import {
  Card,
  CardBody,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useMemo, useState } from "react";
import type { Transaction, TransactionStatus } from "../../types";
import { clients } from "../../lib/mockData";
import { formatCurrency, formatDateTime } from "../../lib/utils";
import { dataTableFillClassNames, tablePanelFillClassName } from "../common/dataTableStyles";
import { StatusChip } from "../common/StatusChip";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import {
  FilterCheckboxGroup,
  TableToolbar,
} from "../common/TableToolbar";

export interface TransactionsTabProps {
  transactions: Transaction[];
}

const columnOptions = [
  { key: "clientName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
  { key: "transactionId", label: "Transaction ID" },
];

export function TransactionsTab({ transactions }: TransactionsTabProps) {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState(
    columnOptions.map((c) => c.key),
  );

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [],
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

  const renderCell = (txn: Transaction, key: string) => {
    const client = clientById.get(txn.clientId);
    switch (key) {
      case "clientName":
        return (
          <div className="min-w-0">
            <p className="truncate font-medium whitespace-nowrap">{txn.clientName}</p>
            <p className="truncate text-caption text-default-400">
              {client?.ownerEmail ?? "—"}
            </p>
          </div>
        );
      case "plan":
        return client?.plan ? (
          <StatusChip kind="plan" value={client.plan} />
        ) : (
          <span className="text-default-400">—</span>
        );
      case "amount":
        return formatCurrency(txn.amount, txn.currency);
      case "status":
        return <StatusChip kind="transaction" value={txn.status} />;
      case "date":
        return formatDateTime(txn.date);
      case "transactionId":
        return (
          <span className="font-mono text-caption text-default-500">{txn.transactionId}</span>
        );
      default:
        return "—";
    }
  };

  return (
    <Card shadow="none" className={tablePanelFillClassName}>
      <CardBody className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search for transaction details..."
          columns={columnOptions}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={setVisibleColumns}
          filterContent={
            <FilterCheckboxGroup
              label="Status"
              options={(["success", "failed", "refunded", "pending"] as TransactionStatus[]).map(
                (status) => ({
                  key: status,
                  label: status.charAt(0).toUpperCase() + status.slice(1),
                }),
              )}
              value={statuses}
              onChange={setStatuses}
            />
          }
        />

        <Table
          aria-label="Transactions table"
          classNames={dataTableFillClassNames}
        >
          <TableHeader columns={headerColumns}>
            {(column) => (
              <TableColumn key={column.key}>{column.label}</TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={filtered}
            emptyContent={
              <NoDataPlaceholder
                title="No transactions found"
                description="Payment charges will appear here once available."
              />
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
      </CardBody>
    </Card>
  );
}
