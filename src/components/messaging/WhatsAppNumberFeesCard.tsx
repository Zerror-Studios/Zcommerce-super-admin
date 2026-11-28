/**
 * Console › Messaging › Rates, "WhatsApp number fees" (backend PRD-051
 * FR-11, Q6): one row per store with a live WhatsApp number for a month
 * (IST, this month by default): the fee debited from its message balance
 * (Charged) or still Due (the balance couldn't cover it; the daily job tries
 * again), with the number's last four digits and the tries. Month picker
 * (YYYY-MM) and a status filter; reads need platform:messaging:read.
 */
import { useQuery } from "@apollo/client";
import { useState } from "react";
import {
  CellText,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  TablePagination,
  TableToolbar,
  formatDateTime,
  type DataTableColumn,
} from "../ui";
import { IconWhatsApp } from "../ui/icons";
import { PLATFORM_WHATSAPP_NUMBER_FEES } from "../../graphql/messaging";
import { formatPaise } from "../../lib/platform-messaging-balance.util";
import { formatReconcileMonth } from "../../lib/platform-messaging-reconciliation.util";
import {
  WHATSAPP_NUMBER_FEE_STATUS_LABEL,
  WHATSAPP_NUMBER_FEE_STATUS_TONE,
  WHATSAPP_NUMBER_FEE_TABS,
  numberFeeErrorText,
  numberFeeVariables,
  validNumberFeeMonth,
  type WhatsAppNumberFee,
  type WhatsAppNumberFeeList,
  type WhatsAppNumberFeeTab,
} from "../../lib/platform-messaging.util";

const PAGE_SIZE = 20;

type FeesData = { platformWhatsAppNumberFees: WhatsAppNumberFeeList };

export function WhatsAppNumberFeesCard() {
  const [month, setMonth] = useState("");
  const [tab, setTab] = useState<WhatsAppNumberFeeTab>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const monthInvalid = month !== "" && validNumberFeeMonth(month) === null;
  const { data, loading, error, refetch } = useQuery<FeesData>(PLATFORM_WHATSAPP_NUMBER_FEES, {
    variables: numberFeeVariables(month || null, tab, pageSize, (page - 1) * pageSize),
    skip: monthInvalid,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const list = data?.platformWhatsAppNumberFees;
  const rows = list?.items ?? [];
  const shownMonth = list?.month ?? (validNumberFeeMonth(month) || null);

  const columns: DataTableColumn<WhatsAppNumberFee>[] = [
    { key: "store", label: "Store", mobile: "title" },
    { key: "status", label: "Status", width: 120, skeleton: "badge", mobile: "badge" },
    { key: "amount", label: "Fee", width: 120, align: "end", mobile: "primary" },
    { key: "attempts", label: "Tries", width: 90, align: "end", hideWhen: "narrow", mobile: "meta" },
    { key: "charged", label: "Charged", width: 190, hideWhen: "narrow", mobile: "meta" },
  ];

  const renderCell = (row: WhatsAppNumberFee, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.tenantName || row.tenantId}</p>
            <p className="truncate text-label text-fg-muted">
              {row.numberLast4 ? `Number ending ${row.numberLast4}` : "Number not known"}
            </p>
          </div>
        );
      case "status":
        return (
          <div className="min-w-0">
            <Chip tone={WHATSAPP_NUMBER_FEE_STATUS_TONE[row.status]}>{WHATSAPP_NUMBER_FEE_STATUS_LABEL[row.status]}</Chip>
            {row.status === "DUE" && numberFeeErrorText(row.lastError) ? (
              <p className="mt-1 line-clamp-2 text-label text-fg-muted">{numberFeeErrorText(row.lastError)}</p>
            ) : null}
          </div>
        );
      case "amount":
        return <CellText className="tabular-nums text-fg">{formatPaise(row.amountPaise)}</CellText>;
      case "attempts":
        return <CellText className="tabular-nums text-fg-muted">{row.attempts}</CellText>;
      case "charged":
        return (
          <CellText className="text-label text-fg-muted">{row.chargedAt ? formatDateTime(row.chargedAt) : "—"}</CellText>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-title-3 font-semibold text-fg">
          WhatsApp number fees{shownMonth ? ` · ${formatReconcileMonth(shownMonth)}` : ""}
        </h2>
        <p className="text-label text-fg-muted">
          {list
            ? list.feePaise > 0
              ? `${formatPaise(list.feePaise)} a month per live number, debited from each store's message balance.`
              : "The monthly number fee is ₹0, so nothing is charged."
            : "Each live number's monthly fee, debited from the store's message balance."}
        </p>
      </div>

      <TableToolbar<WhatsAppNumberFeeTab>
        tabs={WHATSAPP_NUMBER_FEE_TABS.map((item) => ({ value: item.value, label: item.label }))}
        tab={tab}
        onTabChange={(next) => {
          setTab(next);
          setPage(1);
        }}
        tabsLabel="Number fee status"
      >
        <Input
          aria-label="Month"
          type="month"
          size="sm"
          className="w-full sm:w-48"
          value={month || shownMonth || ""}
          onValueChange={(value) => {
            setMonth(value);
            setPage(1);
          }}
          isInvalid={monthInvalid}
          errorMessage={monthInvalid ? "Pick a month" : undefined}
        />
      </TableToolbar>

      {error && !data ? (
        <ErrorState title="Couldn't load the WhatsApp number fees." onRetry={() => void refetch()} />
      ) : (
        <DataTable<WhatsAppNumberFee>
          aria-label="WhatsApp number fees"
          columns={columns}
          rows={rows}
          getRowKey={(row) => `${row.tenantId}:${row.month}`}
          renderCell={renderCell}
          isLoading={loading && !data}
          isReloading={loading && !!data}
          tabKey={`${shownMonth ?? ""}:${tab}`}
          footer={
            data && (rows.length > 0 || page > 1) ? (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={list?.total ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                isDisabled={loading}
              />
            ) : null
          }
          emptyContent={
            <EmptyState
              icon={IconWhatsApp}
              title={
                `${tab === "ALL" ? "No number fees" : `No ${WHATSAPP_NUMBER_FEE_STATUS_LABEL[tab].toLowerCase()} fees`} for ${
                  shownMonth ? formatReconcileMonth(shownMonth) : "this month"
                }`
              }
              description="A store's fee shows here once its own WhatsApp number is live and the monthly fee is set."
            />
          }
        />
      )}
    </div>
  );
}
