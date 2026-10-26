import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useState } from "react";
import { useAiBenchmarks, useAiConfig } from "../../hooks/use-platform-ai";
import { formatMetricValue, metricKeyLabel } from "../../lib/platform-ai.util";
import type { PlatformAiBenchmarkPeriod } from "../../types/platform-api";
import { toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { IconChartBar } from "../ui/icons";
import {
  Card,
  EmptyState,
  ErrorState,
  Select,
  SelectItem,
  Skeleton,
  formatCount,
  formatDate,
  tableRowClasses,
} from "../ui";

const PERIODS: { key: PlatformAiBenchmarkPeriod; label: string }[] = [
  { key: "LAST_30D", label: "Last 30 days" },
  { key: "ALL_TIME", label: "All time" },
];

const right = "block text-right num";

/**
 * AI › Benchmarks (PRD-021 FR-6.6): anonymised medians and quartiles across
 * stores, written nightly by analytics. A metric appears only once enough
 * stores have it (`benchmarkMinStores`); a benchmark never identifies a
 * store.
 */
export function AiBenchmarksTab() {
  const [period, setPeriod] = useState<PlatformAiBenchmarkPeriod>("LAST_30D");
  const api = useAiBenchmarks(period);
  // PRD-024 FR-1.5 (P-06): say why the list can be empty (the minimum is an AI setting).
  const config = useAiConfig();
  const minStores = config.data?.benchmarkMinStores ?? null;
  const rows = api.data;
  const computedFor = rows[0]?.computedFor;

  return (
    <div>
      <PageHeader
        title="AI benchmarks"
        description={
          computedFor
            ? `Anonymised medians across stores, computed for ${formatDate(computedFor)}.`
            : "Anonymised medians across stores."
        }
        actions={
          <Select
            aria-label="Period"
            size="sm"
            className="w-44"
            selectedKeys={new Set([period])}
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (value === "LAST_30D" || value === "ALL_TIME") setPeriod(value);
            }}
            items={PERIODS}
          >
            {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
          </Select>
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load the benchmarks." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <Card padding="none" className="overflow-hidden">
        {api.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table aria-label="AI benchmarks" removeWrapper classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
            <TableHeader>
              <TableColumn>Metric</TableColumn>
              <TableColumn>Section</TableColumn>
              <TableColumn align="end">Stores</TableColumn>
              <TableColumn align="end">25th percentile</TableColumn>
              <TableColumn align="end">Median</TableColumn>
              <TableColumn align="end">75th percentile</TableColumn>
            </TableHeader>
            <TableBody
              items={rows}
              emptyContent={
                <EmptyState
                  icon={IconChartBar}
                  title="No benchmarks yet"
                  description={
                    minStores != null
                      ? `A metric appears once at least ${formatCount(minStores)} stores have data for it, so no store can be identified. The minimum is in AI › Settings.`
                      : "A metric appears once enough stores have data for it, so no store can be identified."
                  }
                />
              }
            >
              {(row) => (
                <TableRow key={`${row.metricKey}:${row.period}`}>
                  <TableCell className="font-medium">{metricKeyLabel(row.metricKey)}</TableCell>
                  <TableCell>{metricKeyLabel(row.category)}</TableCell>
                  <TableCell><span className={right}>{formatCount(row.stores)}</span></TableCell>
                  <TableCell><span className={right}>{formatMetricValue(row.p25, row.unit)}</span></TableCell>
                  <TableCell><span className={right}>{formatMetricValue(row.median, row.unit)}</span></TableCell>
                  <TableCell><span className={right}>{formatMetricValue(row.p75, row.unit)}</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
