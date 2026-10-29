import { useApolloClient } from "@apollo/client";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AI_USAGE_CSV } from "../../graphql/ai";
import { useAiUsageByTenant } from "../../hooks/use-platform-ai";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { getPlanLabel } from "../../lib/display-labels.util";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { aiUsageCsvFile, formatInr, formatRate, formatUsd } from "../../lib/platform-ai.util";
import { downloadCsv } from "../../lib/report-csv";
import { toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { TableToolbar } from "../common/TableToolbar";
import { IconAi, IconDownload } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  cx,
  formatCount,
  tableRowClasses,
  toneTextClasses,
  toastError,
} from "../ui";

const PAGE_SIZE = 25;

const right = "block text-right num";

/**
 * AI › Usage by store (PRD-021 FR-6.2): this week's and this month's
 * questions, tokens and cost per store, most expensive first (the server's
 * order), with the CSV export. Each row opens the store page, where the
 * store's AI setting, top-ups and top questions live.
 */
/** `tabs`: the ZCOM AI › Usage & data tabs, on the left of the toolbar row. */
export function AiUsageTab({ tabs }: { tabs?: ReactNode } = {}) {
  const navigate = useNavigate();
  const client = useApolloClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const api = useAiUsageByTenant({ search: debouncedSearch, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const rows = api.data?.items ?? [];
  const total = api.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await client.query<{ aiUsageCsv: string }>({ query: AI_USAGE_CSV, fetchPolicy: "network-only" });
      const file = aiUsageCsvFile(result.data.aiUsageCsv);
      downloadCsv(file.filename, file.content);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setExporting(false);
    }
  };

  const emptyContent = debouncedSearch ? (
    <EmptyState
      icon={IconAi}
      title={`No stores match "${debouncedSearch}"`}
      description="Search by store name or slug."
      action={<UiButton variant="secondary" onPress={() => setSearch("")}>Clear search</UiButton>}
    />
  ) : (
    <EmptyState icon={IconAi} title="No AI use yet" description="Stores appear here once they ask Ask ZCOM a question." />
  );

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconAi aria-hidden />}
        section="pink"
        title="ZCOM AI usage by store"
        count={total || undefined}
        description="This week and this month, most expensive first."
        actions={
          <UiButton variant="secondary" startIcon={<IconDownload aria-hidden />} isLoading={exporting} onPress={() => void exportCsv()}>
            Download CSV
          </UiButton>
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load AI usage." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <TableToolbar
          tabs={tabs}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          searchPlaceholder="Search stores"
        />
        {api.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table aria-label="AI usage by store" removeWrapper classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn>Plan</TableColumn>
              <TableColumn align="end">This week</TableColumn>
              <TableColumn align="end">This month</TableColumn>
              <TableColumn align="end">Tokens · month</TableColumn>
              <TableColumn align="end">Cost · month</TableColumn>
              <TableColumn align="end">Cache hits</TableColumn>
            </TableHeader>
            <TableBody items={rows} emptyContent={emptyContent}>
              {(row) => (
                <TableRow key={row.tenantId} className="cursor-pointer" onClick={() => navigate(`/stores/${row.tenantId}`)}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate whitespace-nowrap font-medium text-fg">{row.name}</p>
                      <p className="truncate text-caption text-fg-subtle">{row.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="whitespace-nowrap">{row.planName ? getPlanLabel(row.planName) : "—"}</span>
                      {row.paused ? <Chip tone="warning">Paused</Chip> : null}
                      {!row.aiEnabled ? <Chip tone="neutral">AI off</Chip> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cx(right, row.percentOfLimit >= 100 && toneTextClasses.danger)}>
                      {formatCount(row.questionsThisWeek)}
                      {row.questionsPerWeek > 0 ? ` / ${formatCount(row.questionsPerWeek)}` : ""}
                    </span>
                  </TableCell>
                  <TableCell><span className={right}>{formatCount(row.questionsThisMonth)}</span></TableCell>
                  <TableCell><span className={right}>{formatCount(row.tokensThisMonth, true)}</span></TableCell>
                  <TableCell>
                    <span className={right}>{formatUsd(row.costUsdThisMonth)}</span>
                    <span className="block text-right text-caption text-fg-subtle num">{formatInr(row.costInrThisMonth)}</span>
                  </TableCell>
                  <TableCell><span className={right}>{formatRate(row.cacheHitRate)}</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-caption text-fg-muted">
            <span>Page {page + 1} of {pages} · {formatCount(total)} stores</span>
            <div className="flex gap-2">
              <UiButton variant="ghost" size="sm" isDisabled={page === 0} onPress={() => setPage((value) => value - 1)}>Previous</UiButton>
              <UiButton variant="ghost" size="sm" isDisabled={page + 1 >= pages} onPress={() => setPage((value) => value + 1)}>Next</UiButton>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
