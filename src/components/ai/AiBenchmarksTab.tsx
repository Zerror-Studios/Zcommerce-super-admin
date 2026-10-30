import { useCallback, useMemo } from "react";
import { useAiBenchmarks, useAiConfig } from "../../hooks/use-platform-ai";
import { useUrlSearch } from "../../hooks/use-url-search";
import { formatMetricValue, metricKeyLabel } from "../../lib/platform-ai.util";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { matchesText } from "../../lib/text-search.util";
import type { PlatformAiBenchmark, PlatformAiBenchmarkPeriod } from "../../types/platform-api";
import { toasts } from "../../copy";
import { IconChartBar } from "../ui/icons";
import {
  Button,
  DataTable,
  EmptyState,
  SearchInput,
  SegmentedSwitch,
  TablePagination,
  formatCount,
  formatDate,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import { AiErrorCard, AiToolbar } from "./ai-table";
import { datedCsvName, useAiExport, type AiTabProps } from "./ai-export";

/** Fixed 570 → Metric 390px at 960px. */
const columns: DataTableColumn[] = [
  { key: "metric", label: "Metric" },
  { key: "section", label: "Section", width: 130 },
  { key: "stores", label: "Stores", width: 90 },
  { key: "p25", label: "25th percentile", width: 120 },
  { key: "median", label: "Median", width: 110 },
  { key: "p75", label: "75th percentile", width: 120 },
];

const PERIODS: { value: PlatformAiBenchmarkPeriod; label: string }[] = [
  { value: "LAST_30D", label: "Last 30 days" },
  { value: "ALL_TIME", label: "All time" },
];

/**
 * ZCOM AI › Benchmarks (PRD-021 FR-6.6): anonymised medians and quartiles across stores, written nightly by
 * analytics. A metric appears only once enough stores have it (`benchmarkMinStores`); a benchmark never
 * identifies a store. The period is in the URL (`?period=all`).
 */
export function AiBenchmarksTab({ tabs, exportRef }: AiTabProps) {
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const period: PlatformAiBenchmarkPeriod = table.filters.period === "all" ? "ALL_TIME" : "LAST_30D";
  const api = useAiBenchmarks(period);
  // PRD-024 FR-1.5 (P-06): say why the list can be empty (the minimum is an AI setting).
  const config = useAiConfig();
  const minStores = config.data?.benchmarkMinStores ?? null;
  const rows = useMemo(
    () => api.data.filter((row) => matchesText(table.search, metricKeyLabel(row.metricKey), metricKeyLabel(row.category))),
    [api.data, table.search],
  );
  const pageRows = rows.slice(table.offset, table.offset + table.pageSize);
  const computedFor = api.data[0]?.computedFor;

  const runExport = useCallback(() => {
    const csv = rowsToCsv(
      api.data.map((row) => ({
        metric: metricKeyLabel(row.metricKey),
        section: metricKeyLabel(row.category),
        stores: row.stores,
        p25: formatMetricValue(row.p25, row.unit),
        median: formatMetricValue(row.median, row.unit),
        p75: formatMetricValue(row.p75, row.unit),
      })),
      columns.map((column) => ({ key: column.key, label: String(column.label) })),
    );
    downloadCsv(datedCsvName(`ai-benchmarks-${period === "ALL_TIME" ? "all-time" : "last-30-days"}`), csv);
  }, [api.data, period]);
  useAiExport(exportRef, runExport);

  const toolbar = (
    <AiToolbar tabs={tabs}>
      <SearchInput placement="toolbar" placeholder="Search metrics" value={search} onValueChange={setSearch} onClear={() => setSearch("")} />
      <SegmentedSwitch
        size="sm"
        ariaLabel="Benchmark period"
        value={period}
        onChange={(next) => table.setFilter("period", next === "ALL_TIME" ? "all" : undefined)}
        items={PERIODS}
      />
    </AiToolbar>
  );

  if (api.error) {
    return <AiErrorCard tabs={tabs} title="Couldn't load the benchmarks." description={toasts.genericError} onRetry={() => void api.refetch()} />;
  }

  return (
    <DataTable<PlatformAiBenchmark>
      aria-label="AI benchmarks"
      columns={columns}
      rows={pageRows}
      getRowKey={(row) => `${row.metricKey}:${row.period}`}
      isLoading={api.loading}
      toolbar={toolbar}
      renderCell={(row, key) => {
        switch (key) {
          case "metric":
            return <span className="block truncate font-medium text-fg">{metricKeyLabel(row.metricKey)}</span>;
          case "section":
            return <span className="block truncate">{metricKeyLabel(row.category)}</span>;
          case "stores":
            return <span className="num">{formatCount(row.stores)}</span>;
          case "p25":
          case "median":
          case "p75":
            return <span className="whitespace-nowrap num">{formatMetricValue(row[key], row.unit)}</span>;
          default:
            return null;
        }
      }}
      footer={
        <>
          {computedFor ? (
            <p className="border-t border-line-subtle px-4 pt-3 text-label text-fg-muted">
              Anonymised across stores, computed for {formatDate(computedFor)}.
            </p>
          ) : null}
          <TablePagination
            page={table.page}
            pageSize={table.pageSize}
            total={rows.length}
            onPageChange={table.setPage}
            onPageSizeChange={table.setPageSize}
          />
        </>
      }
      emptyContent={
        table.search.trim() ? (
          <EmptyState
            kind="no-results"
            icon={IconChartBar}
            title="No matching metrics"
            description="Try another metric or section name."
            action={
              <Button variant="secondary" size="sm" onPress={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={IconChartBar}
            title="No benchmarks yet"
            description={
              minStores != null
                ? `A metric appears once at least ${formatCount(minStores)} stores have data for it, so no store can be identified. The minimum is in Settings › ZCOM AI settings.`
                : "A metric appears once enough stores have data for it, so no store can be identified."
            }
          />
        )
      }
    />
  );
}
