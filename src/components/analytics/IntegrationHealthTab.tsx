import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIntegrationHealth } from "../../hooks/use-platform-analytics";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { errorPreview } from "../../lib/analytics-health";
import {
  CHANNEL_TYPE_LABELS,
  getAppProviderLabel,
  getChannelTypeLabel,
} from "../../lib/display-labels.util";
import { emptyStates, toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { TableToolbar } from "../common/TableToolbar";
import { IconApps } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  EmptyState,
  ErrorState,
  KpiStrip,
  Select,
  SelectItem,
  Skeleton,
  StatCard,
  Tooltip,
  cx,
  formatCount,
  formatDate,
  formatDateTime,
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import { AnalyticsHealthChip, IntegrationStatusChip } from "./AnalyticsHealthChip";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "ERROR", label: "Error" },
];

const TYPE_OPTIONS = Object.entries(CHANNEL_TYPE_LABELS).map(([key, label]) => ({ key, label }));

const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

const right = "block text-right num";

/** One compact filter select in the toolbar; an empty selection means "all". */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      placeholder={label}
      size="sm"
      className="w-40"
      selectedKeys={value ? [value] : []}
      onSelectionChange={(keys) => onChange(String(Array.from(keys)[0] ?? ""))}
      items={options}
    >
      {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
    </Select>
  );
}

/**
 * Analytics › Integration health (PRD-012 FR-8.3): every app installed across
 * stores (payment, shipping, messaging, marketplace, analytics) with its
 * connection status, last test and sync, last error and, for analytics apps,
 * the sync health and the day data runs through. Read from the master
 * `channel_connection` and `analytics_sync_summary` collections only.
 */
export function IntegrationHealthTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [channelType, setChannelType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  // One query per pause in typing, not per keystroke (review C-M6).
  const debouncedSearch = useDebouncedValue(search.trim());

  /* ----- Queries & Mutations ----- */
  const api = useIntegrationHealth({
    filter: { provider, channelType, status, search: debouncedSearch },
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const data = api.data;
  const rows = data?.rows ?? [];
  const total = data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(debouncedSearch || provider || channelType || status);

  const countOf = (key: string) => data?.counts.find((entry) => entry.status === key)?.count ?? 0;
  const installations = useMemo(
    () => (data?.counts ?? []).reduce((sum, entry) => sum + entry.count, 0),
    [data?.counts],
  );
  const providerOptions = useMemo(
    () => (data?.byProvider ?? []).map((entry) => ({ key: entry.provider, label: getAppProviderLabel(entry.provider) })),
    [data?.byProvider],
  );

  /* ----- Handlers ----- */
  const withReset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };
  const clearFilters = () => {
    setSearch("");
    setProvider("");
    setChannelType("");
    setStatus("");
    setPage(0);
  };

  const emptyContent = hasFilters ? (
    <EmptyState
      icon={IconApps}
      title="No installations match"
      description="Check the spelling or clear the filters."
      action={<UiButton variant="secondary" onPress={clearFilters}>Clear filters</UiButton>}
    />
  ) : (
    <EmptyState
      icon={IconApps}
      title="No installations yet"
      description="Apps that stores install appear here with their connection health."
    />
  );

  return (
    <div>
      <PageHeader
        title="Integration health"
        description="Every app installed across stores, with its connection status and last sync."
      />

      {api.error ? (
        <ErrorState title="Couldn't load integration health." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <div className="space-y-4">
        <KpiStrip>
          <StatCard bare isLoading={api.loading} label="Installations" value={installations} deltaLabel="Across all stores" />
          <StatCard bare isLoading={api.loading} label="Active" value={countOf("ACTIVE")} deltaLabel="Connected and working" />
          <StatCard
            bare
            isLoading={api.loading}
            label="Error"
            value={countOf("ERROR")}
            valueTone={countOf("ERROR") > 0 ? "danger" : "default"}
            deltaLabel="Failed the last test or sync"
          />
          <StatCard bare isLoading={api.loading} label="Inactive" value={countOf("INACTIVE")} deltaLabel="Installed but switched off" />
        </KpiStrip>

        <Card title="By provider" padding="none" className="overflow-hidden">
          <Table aria-label="Installations by provider" removeWrapper classNames={cardTableClassNames}>
            <TableHeader>
              <TableColumn>Provider</TableColumn>
              <TableColumn align="end">Installations</TableColumn>
              <TableColumn align="end">Errors</TableColumn>
            </TableHeader>
            <TableBody items={data?.byProvider ?? []} emptyContent={<EmptyState compact description={emptyStates.noData} />}>
              {(row) => (
                <TableRow key={row.provider}>
                  <TableCell className="font-medium">{getAppProviderLabel(row.provider)}</TableCell>
                  <TableCell><span className={right}>{formatCount(row.count)}</span></TableCell>
                  <TableCell>
                    <span className={cx(right, row.errors > 0 && toneTextClasses.danger)}>{formatCount(row.errors)}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <TableToolbar
            search={search}
            onSearchChange={withReset(setSearch)}
            searchPlaceholder="Search stores"
            endContent={
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Provider" value={provider} options={providerOptions} onChange={withReset(setProvider)} />
                <FilterSelect label="Type" value={channelType} options={TYPE_OPTIONS} onChange={withReset(setChannelType)} />
                <FilterSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={withReset(setStatus)} />
              </div>
            }
          />
          {api.loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <Table aria-label="Installed apps" removeWrapper classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
              <TableHeader>
                <TableColumn>Store</TableColumn>
                <TableColumn>App</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Last test</TableColumn>
                <TableColumn>Last sync</TableColumn>
                <TableColumn>Last error</TableColumn>
                <TableColumn>Analytics</TableColumn>
                <TableColumn>Data through</TableColumn>
              </TableHeader>
              <TableBody items={rows} emptyContent={emptyContent}>
                {(row) => {
                  const preview = errorPreview(row.lastError);
                  return (
                    <TableRow
                      key={row.connectionId}
                      className="cursor-pointer"
                      onClick={() => navigate(`/stores/${row.tenantId}`)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap font-medium text-fg">{row.name}</p>
                          <p className="truncate text-caption text-fg-subtle">{row.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="whitespace-nowrap text-fg">{getAppProviderLabel(row.provider)}</p>
                        <p className="text-caption text-fg-subtle">{getChannelTypeLabel(row.channelType)}</p>
                      </TableCell>
                      <TableCell><IntegrationStatusChip status={row.status} /></TableCell>
                      <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.lastTestedAt)}</span></TableCell>
                      <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.lastSyncAt)}</span></TableCell>
                      <TableCell>
                        {preview ? (
                          <Tooltip content={<span className="block max-w-sm whitespace-pre-wrap break-words">{row.lastError}</span>}>
                            <span className={cx("block max-w-xs truncate text-caption", toneTextClasses.danger)}>{preview}</span>
                          </Tooltip>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.channelType === "ANALYTICS" || row.analyticsHealth ? (
                          <AnalyticsHealthChip health={row.analyticsHealth} />
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TableCell>
                      <TableCell><span className="whitespace-nowrap num">{formatDate(row.dataThrough)}</span></TableCell>
                    </TableRow>
                  );
                }}
              </TableBody>
            </Table>
          )}
          {pages > 1 ? (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-caption text-fg-muted">
              <span>Page {page + 1} of {pages} · {formatCount(total)} installations</span>
              <div className="flex gap-2">
                <UiButton variant="ghost" size="sm" isDisabled={page === 0} onPress={() => setPage((value) => value - 1)}>Previous</UiButton>
                <UiButton variant="ghost" size="sm" isDisabled={page + 1 >= pages} onPress={() => setPage((value) => value + 1)}>Next</UiButton>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
