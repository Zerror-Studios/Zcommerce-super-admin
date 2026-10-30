import { useCallback, useMemo } from "react";
import { useUrlSearch } from "../../hooks/use-url-search";
import { formatUsd, formatUsdInr } from "../../lib/platform-ai.util";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { matchesText } from "../../lib/text-search.util";
import type { PlatformAiModelMix } from "../../types/platform-api";
import { IconAi } from "../ui/icons";
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  SearchInput,
  TablePagination,
  formatCount,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import { AiToolbar } from "./ai-table";
import { datedCsvName, useAiExport, type AiTabProps } from "./ai-export";

const columns: DataTableColumn[] = [
  { key: "model", label: "Model" },
  { key: "role", label: "Role", width: 120, skeleton: "badge" },
  { key: "calls", label: "Calls", width: 120 },
  { key: "cost", label: "Cost", width: 140 },
];

export interface AiModelsTabProps extends AiTabProps {
  models: PlatformAiModelMix[];
  loading: boolean;
  defaultModel?: string;
  reasoningModel?: string;
  /** Rupees per dollar; null shows dollars only. */
  inrRate: number | null;
}

function roleOf(model: string, defaultModel?: string, reasoningModel?: string): string | null {
  if (model === defaultModel) return "Default";
  if (model === reasoningModel) return "Reasoning";
  return null;
}

/** ZCOM AI › Spend by model (PRD-021 FR-6.3): this month's calls and cost per model. No row click. */
export function AiModelsTab({ tabs, exportRef, models, loading, defaultModel, reasoningModel, inrRate }: AiModelsTabProps) {
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const rows = useMemo(() => models.filter((row) => matchesText(table.search, row.model)), [models, table.search]);
  const pageRows = rows.slice(table.offset, table.offset + table.pageSize);
  const inr = (usd: number) => (inrRate != null ? usd * inrRate : null);

  const runExport = useCallback(() => {
    const csv = rowsToCsv(
      models.map((row) => ({
        model: row.model,
        role: roleOf(row.model, defaultModel, reasoningModel) ?? "",
        calls: row.calls,
        costUsd: formatUsd(row.costUsd),
        costInr: inrRate != null ? Math.round(row.costUsd * inrRate) : "",
      })),
      [
        { key: "model", label: "Model" },
        { key: "role", label: "Role" },
        { key: "calls", label: "Calls" },
        { key: "costUsd", label: "Cost (USD)" },
        { key: "costInr", label: "Cost (INR)" },
      ],
    );
    downloadCsv(datedCsvName("ai-spend-by-model"), csv);
  }, [models, defaultModel, reasoningModel, inrRate]);
  useAiExport(exportRef, runExport);

  return (
    <DataTable<PlatformAiModelMix>
      aria-label="AI spend by model"
      columns={columns}
      rows={pageRows}
      getRowKey={(row) => row.model}
      isLoading={loading}
      toolbar={
        <AiToolbar tabs={tabs}>
          <SearchInput placement="toolbar" placeholder="Search models" value={search} onValueChange={setSearch} onClear={() => setSearch("")} />
        </AiToolbar>
      }
      renderCell={(row, key) => {
        switch (key) {
          case "model":
            return <span className="block truncate font-mono text-label text-fg">{row.model}</span>;
          case "role": {
            const role = roleOf(row.model, defaultModel, reasoningModel);
            return role ? <Chip tone="neutral">{role}</Chip> : <span className="text-fg-muted">—</span>;
          }
          case "calls":
            return <span className="num">{formatCount(row.calls)}</span>;
          case "cost":
            return <span className="whitespace-nowrap num">{formatUsdInr(row.costUsd, inr(row.costUsd))}</span>;
          default:
            return null;
        }
      }}
      footer={
        <TablePagination
          page={table.page}
          pageSize={table.pageSize}
          total={rows.length}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      }
      emptyContent={
        table.search.trim() ? (
          <EmptyState
            kind="no-results"
            icon={IconAi}
            title="No matching models"
            description="Try another model name."
            action={
              <Button variant="secondary" size="sm" onPress={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState icon={IconAi} title="No AI spend this month" description="Models show here once stores ask questions." />
        )
      }
    />
  );
}
