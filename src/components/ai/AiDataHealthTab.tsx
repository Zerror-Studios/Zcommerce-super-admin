import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAiDataHealth } from "../../hooks/use-platform-ai";
import { useUrlSearch } from "../../hooks/use-url-search";
import { aiDataHealthIssues } from "../../lib/platform-ai.util";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { matchesText } from "../../lib/text-search.util";
import type { PlatformAiDataHealthRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { IconStoreHealth } from "../ui/icons";
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  SearchInput,
  Switch,
  TablePagination,
  formatCount,
  formatDateTime,
  formatPercent,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import { AiErrorCard, AiToolbar, StoreCell } from "./ai-table";
import { datedCsvName, useAiExport, type AiTabProps } from "./ai-export";

/** Two flex columns (Store, Needs) share what the fixed 490 leave. */
const columns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "needs", label: "Needs" },
  { key: "coverage", label: "Cost coverage", width: 110 },
  { key: "months", label: "Spend months", width: 110 },
  { key: "profit", label: "Profitability", width: 120, skeleton: "badge" },
  { key: "run", label: "Last run", width: 150 },
];

/**
 * ZCOM AI › Data health (PRD-021 FR-6.5): stores whose Business Insights are held back by missing data (cost prices
 * under 80%, Business settings not filled in) or a failed run. "Show all stores" lists every store with insights.
 * Search matches the stores on this page (data health has no server search).
 */
export function AiDataHealthTab({ tabs, exportRef }: AiTabProps) {
  const navigate = useNavigate();
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  // PRD-024 FR-1.10 (B-11): every store with insights, not only those needing a nudge.
  const showAll = table.filters.all === "1";
  const api = useAiDataHealth({ needsAttention: !showAll, limit: table.pageSize, offset: table.offset });
  const loaded = useMemo(() => api.data?.items ?? [], [api.data]);
  const rows = loaded.filter((row) => matchesText(table.search, row.storeName, row.slug));
  const total = api.data?.totalCount ?? 0;

  const runExport = useCallback(() => {
    const csv = rowsToCsv(
      loaded.map((row) => ({
        store: row.storeName,
        slug: row.slug ?? "",
        needs: aiDataHealthIssues(row).join("; "),
        coverage: formatPercent(row.costCoveragePct),
        months: row.spendMonths,
        profit: row.canSeeProfitability ? "Visible" : "Hidden",
        run: formatDateTime(row.computedAt),
      })),
      [
        { key: "store", label: "Store" },
        { key: "slug", label: "Slug" },
        { key: "needs", label: "Needs" },
        { key: "coverage", label: "Cost coverage" },
        { key: "months", label: "Spend months" },
        { key: "profit", label: "Profitability" },
        { key: "run", label: "Last run" },
      ],
    );
    downloadCsv(datedCsvName("ai-data-health"), csv);
  }, [loaded]);
  useAiExport(exportRef, runExport);

  const toolbar = (
    <AiToolbar tabs={tabs}>
      <SearchInput placement="toolbar" placeholder="Search stores" value={search} onValueChange={setSearch} onClear={() => setSearch("")} />
      <Switch size="sm" isSelected={showAll} onValueChange={(on) => table.setFilter("all", on ? "1" : undefined)}>
        Show all stores
      </Switch>
    </AiToolbar>
  );

  if (api.error) {
    return <AiErrorCard tabs={tabs} title="Couldn't load data health." description={toasts.genericError} onRetry={() => void api.refetch()} />;
  }

  return (
    <DataTable<PlatformAiDataHealthRow>
      aria-label={showAll ? "AI data health by store" : "Stores needing data attention"}
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.tenantId}
      isLoading={api.loading}
      rowHeight="tall"
      onRowAction={(row) => navigate(`/stores/${row.tenantId}/ai`)}
      toolbar={toolbar}
      renderCell={(row, key) => {
        switch (key) {
          case "store":
            return <StoreCell name={row.storeName} slug={row.slug} />;
          case "needs": {
            const issues = aiDataHealthIssues(row);
            return issues.length === 0 ? (
              <Chip tone="success">Nothing</Chip>
            ) : (
              <p className="line-clamp-2 text-label text-fg-muted" title={issues.join(" · ")}>
                {issues.join(" · ")}
              </p>
            );
          }
          case "coverage":
            return <span className="num">{formatPercent(row.costCoveragePct)}</span>;
          case "months":
            return <span className="num">{formatCount(row.spendMonths)}</span>;
          case "profit":
            return row.canSeeProfitability ? <Chip tone="success">Visible</Chip> : <Chip tone="warning">Hidden</Chip>;
          case "run":
            return (
              <div className="min-w-0">
                <span className="block whitespace-nowrap num">{formatDateTime(row.computedAt)}</span>
                {row.computeStatus !== "OK" ? (
                  <span className="block text-label text-fg-muted">{row.computeStatus === "FAILED" ? "Failed" : row.computeStatus.toLowerCase()}</span>
                ) : null}
              </div>
            );
          default:
            return null;
        }
      }}
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
        table.search.trim() ? (
          <EmptyState
            kind="no-results"
            icon={IconStoreHealth}
            title="No matching stores"
            description="No store on this page matches that search."
            action={
              <Button variant="secondary" size="sm" onPress={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : showAll ? (
          <EmptyState icon={IconStoreHealth} title="No store has computed insights yet" description="Stores appear after their first insights run." />
        ) : (
          <EmptyState icon={IconStoreHealth} title="Every store's data is in shape" description="No store needs a nudge right now." />
        )
      }
    />
  );
}
