import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAiDataHealth } from "../../hooks/use-platform-ai";
import { aiDataHealthIssues } from "../../lib/platform-ai.util";
import { matchesText } from "../../lib/text-search.util";
import { toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { FilterEmpty } from "../common/FilterEmpty";
import { TableToolbar } from "../common/TableToolbar";
import { IconStoreHealth } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  Switch,
  formatCount,
  formatDateTime,
  formatPercent,
  tableRowClasses,
} from "../ui";

const PAGE_SIZE = 25;

/**
 * AI › Data health (PRD-021 FR-6.5): stores whose Business Insights are
 * held back by missing data (cost prices under 80%, Business settings not
 * filled in) or a failed run. Use it to nudge merchants; the numbers come
 * from each store's latest snapshot.
 */
/** `tabs`: the ZCOM AI › Usage & data tabs, on the left of the toolbar row. */
export function AiDataHealthTab({ tabs }: { tabs?: ReactNode } = {}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  // PRD-024 FR-1.10 (B-11): every store with insights, not only those needing a nudge.
  // Stores that never computed insights have no row on the server yet (backend follow-up).
  const [showAll, setShowAll] = useState(false);
  const api = useAiDataHealth({ needsAttention: !showAll, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  // Searches this page's rows (data health has no server search).
  const [search, setSearch] = useState("");
  const rows = (api.data?.items ?? []).filter((row) => matchesText(search, row.storeName, row.slug));
  const total = api.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconStoreHealth aria-hidden />}
        section="pink"
        title="ZCOM AI data health"
        count={total || undefined}
        description={
          showAll
            ? "Every store that has computed insights, lowest cost coverage first."
            : "Stores whose insights are held back by missing data or a failed run."
        }
        actions={
          <Switch
            size="sm"
            isSelected={showAll}
            onValueChange={(on) => {
              setShowAll(on);
              setPage(0);
            }}
          >
            Show all stores
          </Switch>
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load data health." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <TableToolbar tabs={tabs} search={search} onSearchChange={setSearch} searchPlaceholder="Search stores on this page" />
        {api.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table aria-label={showAll ? "AI data health by store" : "Stores needing data attention"} removeWrapper classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn>Needs</TableColumn>
              <TableColumn align="end">Cost coverage</TableColumn>
              <TableColumn align="end">Spend months</TableColumn>
              <TableColumn>Profitability</TableColumn>
              <TableColumn>Last run</TableColumn>
            </TableHeader>
            <TableBody
              items={rows}
              emptyContent={
                search.trim() ? (
                  <FilterEmpty things="stores" query={search} onClear={() => setSearch("")} />
                ) : showAll ? (
                  <EmptyState icon={IconStoreHealth} title="No store has computed insights yet" description="Stores appear after their first insights run." />
                ) : (
                  <EmptyState icon={IconStoreHealth} title="Every store's data is in shape" description="No store needs a nudge right now." />
                )
              }
            >
              {(row) => (
                <TableRow key={row.tenantId} className="cursor-pointer" onClick={() => navigate(`/stores/${row.tenantId}`)}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate whitespace-nowrap font-medium text-fg">{row.storeName}</p>
                      <p className="truncate text-caption text-fg-subtle">{row.slug ?? "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {aiDataHealthIssues(row).length === 0 ? (
                      <Chip tone="success">Nothing</Chip>
                    ) : (
                      <ul className="text-caption text-fg-muted">
                        {aiDataHealthIssues(row).map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell><span className="block text-right num">{formatPercent(row.costCoveragePct)}</span></TableCell>
                  <TableCell><span className="block text-right num">{formatCount(row.spendMonths)}</span></TableCell>
                  <TableCell>
                    {row.canSeeProfitability ? <Chip tone="success">Visible</Chip> : <Chip tone="warning">Hidden</Chip>}
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap num">{formatDateTime(row.computedAt)}</span>
                    {row.computeStatus !== "OK" ? (
                      <span className="block text-caption text-fg-subtle">{row.computeStatus.toLowerCase()}</span>
                    ) : null}
                  </TableCell>
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
