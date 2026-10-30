import { useApolloClient } from "@apollo/client";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AI_USAGE_CSV } from "../../graphql/ai";
import { useAiUsageByTenant } from "../../hooks/use-platform-ai";
import { useUrlSearch } from "../../hooks/use-url-search";
import { getPlanLabel } from "../../lib/display-labels.util";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { aiUsageCsvFile, formatRate, formatUsdInr } from "../../lib/platform-ai.util";
import { downloadCsv } from "../../lib/report-csv";
import type { PlatformAiUsageRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { IconAi } from "../ui/icons";
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  FilterButton,
  FilterDrawer,
  SearchInput,
  TablePagination,
  countActiveFilters,
  cx,
  formatCount,
  toastError,
  toneTextClasses,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
} from "../ui";
import { AiErrorCard, AiToolbar, StoreCell } from "./ai-table";
import { useAiExport, type AiTabProps } from "./ai-export";

/** Fixed 730 → Store 230px at 960px (04 S-06). */
const columns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "plan", label: "Plan", width: 130 },
  { key: "week", label: "This week", width: 120 },
  { key: "month", label: "This month", width: 120 },
  { key: "tokens", label: "Tokens · month", width: 130 },
  { key: "cost", label: "Cost · month", width: 130 },
  { key: "cache", label: "Cache hits", width: 100 },
];

const filterGroups: FilterGroup[] = [
  {
    key: "ai",
    label: "AI",
    type: "single",
    options: [
      { value: "on", label: "On" },
      { value: "off", label: "Off" },
    ],
  },
];

/** The server has no AI on/off filter: with one set, read the largest page it serves and filter here. */
const FILTERED_READ_LIMIT = 200;

/**
 * ZCOM AI › Usage by store (PRD-021 FR-6.2, 04 S-06): this week's and this month's questions, tokens and cost per
 * store, most expensive first (the server's order). Each row opens the store's ZCOM AI section.
 */
export function AiUsageTab({ tabs, exportRef }: AiTabProps) {
  const navigate = useNavigate();
  const client = useApolloClient();
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const aiFilter = table.filters.ai === "on" || table.filters.ai === "off" ? table.filters.ai : "";

  const api = useAiUsageByTenant({
    search: table.search.trim(),
    limit: aiFilter ? FILTERED_READ_LIMIT : table.pageSize,
    offset: aiFilter ? 0 : table.offset,
  });
  const serverRows = useMemo(() => api.data?.items ?? [], [api.data]);
  const filteredRows = useMemo(
    () => (aiFilter ? serverRows.filter((row) => row.aiEnabled === (aiFilter === "on")) : serverRows),
    [aiFilter, serverRows],
  );
  const rows = aiFilter ? filteredRows.slice(table.offset, table.offset + table.pageSize) : serverRows;
  const total = aiFilter ? filteredRows.length : (api.data?.totalCount ?? 0);

  const runExport = useCallback(async () => {
    try {
      const result = await client.query<{ aiUsageCsv: string }>({ query: AI_USAGE_CSV, fetchPolicy: "network-only" });
      const file = aiUsageCsvFile(result.data.aiUsageCsv);
      downloadCsv(file.filename, file.content);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    }
  }, [client]);
  useAiExport(exportRef, runExport);

  const filterValues: FilterValues = { ai: aiFilter };
  const filtered = !!table.search.trim() || !!aiFilter;

  if (api.error) {
    return (
      <AiErrorCard tabs={tabs} title="Couldn't load AI usage." description={toasts.genericError} onRetry={() => void api.refetch()} />
    );
  }

  return (
    <>
      <DataTable<PlatformAiUsageRow>
        aria-label="AI usage by store"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.tenantId}
        isLoading={api.loading}
        rowHeight="tall"
        onRowAction={(row) => navigate(`/stores/${row.tenantId}/ai`)}
        toolbar={
          <AiToolbar tabs={tabs}>
            <SearchInput
              placement="toolbar"
              placeholder="Search stores"
              value={search}
              onValueChange={setSearch}
              onClear={() => setSearch("")}
            />
            <FilterButton count={countActiveFilters(filterValues)} onPress={() => setFiltersOpen(true)} />
          </AiToolbar>
        }
        renderCell={(row, key) => {
          switch (key) {
            case "store":
              return <StoreCell name={row.name} slug={row.slug} />;
            case "plan":
              return (
                <div className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="truncate">{row.planName ? getPlanLabel(row.planName) : "—"}</span>
                  {!row.aiEnabled ? <Chip tone="neutral">AI off</Chip> : row.paused ? <Chip tone="warning">Paused</Chip> : null}
                </div>
              );
            case "week":
              return (
                <span className={cx("whitespace-nowrap num", row.percentOfLimit >= 100 && toneTextClasses.danger)}>
                  {formatCount(row.questionsThisWeek)}
                  {row.questionsPerWeek > 0 ? ` / ${formatCount(row.questionsPerWeek)}` : ""}
                </span>
              );
            case "month":
              return <span className="num">{formatCount(row.questionsThisMonth)}</span>;
            case "tokens":
              return <span className="whitespace-nowrap num">{formatCount(row.tokensThisMonth)}</span>;
            case "cost":
              return <span className="whitespace-nowrap num">{formatUsdInr(row.costUsdThisMonth, row.costInrThisMonth)}</span>;
            case "cache":
              return <span className="num">{formatRate(row.cacheHitRate)}</span>;
            default:
              return null;
          }
        }}
        mobileRow={(row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{row.name}</p>
            <p className="truncate text-label text-fg-muted num">
              {formatCount(row.questionsThisMonth)} questions · {formatUsdInr(row.costUsdThisMonth, row.costInrThisMonth)}
              {!row.aiEnabled ? " · AI off" : ""}
            </p>
          </div>
        )}
        footer={
          <TablePagination
            page={table.page}
            pageSize={table.pageSize}
            total={total}
            onPageChange={table.setPage}
            onPageSizeChange={table.setPageSize}
          />
        }
        emptyContent={
          filtered ? (
            <EmptyState
              kind="no-results"
              icon={IconAi}
              title="No matching stores"
              description="Search by store name or slug, or change the filter."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setSearch("");
                    table.setParams({ q: undefined, ai: undefined });
                  }}
                >
                  Clear search and filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={IconAi} title="No AI use yet" description="Stores appear here once they ask Ask ZCOM a question." />
          )
        }
      />
      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={filterGroups}
        value={filterValues}
        onApply={(values) => table.setFilter("ai", typeof values.ai === "string" ? values.ai : undefined)}
        onClear={() => table.setFilter("ai", undefined)}
      />
    </>
  );
}
