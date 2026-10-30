import { DropdownItem, DropdownTrigger } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIntegrationHealth } from "../../hooks/use-platform-analytics";
import { useUrlSearch } from "../../hooks/use-url-search";
import { errorPreview } from "../../lib/analytics-health";
import { CHANNEL_TYPE_LABELS, getAppProviderLabel, getChannelTypeLabel } from "../../lib/display-labels.util";
import type { IntegrationHealthRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { AppliedFilters, type AppliedFilterItem } from "../common/AppliedFilters";
import { IconApps, IconColumns } from "../ui/icons";
import {
  Button,
  DataTable,
  Dropdown,
  DropdownMenu,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterDrawer,
  IconButton,
  KpiStrip,
  SearchInput,
  StatCard,
  TablePagination,
  Tooltip,
  countActiveFilters,
  cx,
  formatCount,
  formatDate,
  formatDateTime,
  toneTextClasses,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
} from "../ui";
import { AnalyticsHealthChip, IntegrationStatusChip } from "./AnalyticsHealthChip";
import {
  LogoTile,
  TableCard,
  TwoLine,
  NoDataEmpty,
  type AnalyticsTabProps,
} from "./analytics-shared";
import { storeHref } from "./analytics-tab.util";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ERROR", label: "Error" },
];

const TYPE_OPTIONS = Object.entries(CHANNEL_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/** Fixed 710 → Store 250px at 960px. "Analytics" is in the Columns menu, off by default. */
const COLUMNS: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "app", label: "App", width: 150 },
  { key: "status", label: "Status", width: 150, skeleton: "badge" },
  { key: "lastSync", label: "Last sync", width: 150 },
  { key: "lastTest", label: "Last test", width: 150 },
  { key: "dataThrough", label: "Data through", width: 110, hideWhen: "narrow" },
  { key: "analytics", label: "Analytics", width: 130, hideWhen: "narrow", skeleton: "badge" },
];
const DEFAULT_COLUMNS = COLUMNS.map((column) => column.key).filter((key) => key !== "analytics");

const providerColumns: DataTableColumn[] = [
  { key: "provider", label: "Provider" },
  { key: "count", label: "Installations", width: 120 },
  { key: "errors", label: "Errors", width: 90 },
];

interface ProviderRow {
  provider: string;
  count: number;
  errors: number;
}

/**
 * Analytics › Integration health (04 S-05d, PRD-012 FR-8.3): every app installed across stores with its
 * connection status, last test and sync, last error and, for analytics apps, the sync health and the day data
 * runs through. Search, filters and page live in the URL; the server filters.
 */
export function IntegrationHealthTab({ tabRow }: AnalyticsTabProps) {
  const navigate = useNavigate();
  const table = useTableUrlState();
  // One query per pause in typing, not per keystroke (review C-M6).
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = usePersistentColumns("analytics-integrations", DEFAULT_COLUMNS);
  const provider = table.filters.provider ?? "";
  const channelType = table.filters.type ?? "";
  const status = table.filters.status ?? "";

  const api = useIntegrationHealth({
    filter: { provider, channelType, status, search: table.search.trim() },
    limit: table.pageSize,
    offset: table.offset,
  });
  const data = api.data;
  const rows = data?.rows ?? [];
  const total = data?.totalCount ?? 0;
  const hasFilters = Boolean(table.search.trim() || provider || channelType || status);

  const countOf = (key: string) => data?.counts.find((entry) => entry.status === key)?.count ?? 0;
  const installations = useMemo(() => (data?.counts ?? []).reduce((sum, entry) => sum + entry.count, 0), [data?.counts]);
  const providerOptions = useMemo(
    () => (data?.byProvider ?? []).map((entry) => ({ value: entry.provider, label: getAppProviderLabel(entry.provider) })),
    [data?.byProvider],
  );

  const groups = useMemo<FilterGroup[]>(
    () => [
      ...(providerOptions.length ? [{ key: "provider", label: "Provider", type: "single" as const, options: providerOptions }] : []),
      { key: "type", label: "Type", type: "single", options: TYPE_OPTIONS },
      { key: "status", label: "Status", type: "single", options: STATUS_OPTIONS },
    ],
    [providerOptions],
  );
  const filterValues: FilterValues = { provider, type: channelType, status };

  const labelOf = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const applied: AppliedFilterItem[] = [
    ...(provider ? [{ key: "provider", label: `Provider: ${labelOf(providerOptions, provider)}`, onRemove: () => table.setFilter("provider") }] : []),
    ...(channelType ? [{ key: "type", label: `Type: ${labelOf(TYPE_OPTIONS, channelType)}`, onRemove: () => table.setFilter("type") }] : []),
    ...(status ? [{ key: "status", label: `Status: ${labelOf(STATUS_OPTIONS, status)}`, onRemove: () => table.setFilter("status") }] : []),
  ];

  const clearAll = () => {
    setSearch("");
    table.setParams({ provider: undefined, type: undefined, status: undefined, q: undefined });
  };

  const renderCell = (row: IntegrationHealthRow, key: string) => {
    switch (key) {
      case "store":
        return <TwoLine main={row.name} sub={row.slug} />;
      case "app": {
        const label = getAppProviderLabel(row.provider);
        return (
          <span className="flex min-w-0 items-center gap-2">
            <LogoTile name={label} />
            <span className="min-w-0">
              <span className="block truncate text-fg">{label}</span>
              <span className="block truncate text-label text-fg-muted">{getChannelTypeLabel(row.channelType)}</span>
            </span>
          </span>
        );
      }
      case "status": {
        // The last error sits under the badge (it replaces the live "Last error" column so the table fits).
        const preview = errorPreview(row.lastError, 24);
        return (
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <IntegrationStatusChip status={row.status} />
            {preview ? (
              <Tooltip content={<span className="block max-w-sm whitespace-pre-wrap break-words">{row.lastError}</span>}>
                <span className={cx("block max-w-full truncate text-caption", toneTextClasses.danger)}>{preview}</span>
              </Tooltip>
            ) : null}
          </div>
        );
      }
      case "lastSync":
        return <span className="num">{formatDateTime(row.lastSyncAt)}</span>;
      case "lastTest":
        return <span className="num">{formatDateTime(row.lastTestedAt)}</span>;
      case "dataThrough":
        return <span className="num">{formatDate(row.dataThrough)}</span>;
      case "analytics":
        return row.channelType === "ANALYTICS" || row.analyticsHealth ? (
          <AnalyticsHealthChip health={row.analyticsHealth} />
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      default:
        return null;
    }
  };

  const toolbar = (
    <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2">
      <SearchInput
        placement="toolbar"
        placeholder="Search stores or apps"
        value={search}
        onValueChange={setSearch}
        onClear={() => setSearch("")}
      />
      <FilterButton count={countActiveFilters(filterValues)} onPress={() => setFiltersOpen(true)} />
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <IconButton aria-label="Choose columns" variant="default" size="sm" showTooltip={false}>
            <IconColumns aria-hidden />
          </IconButton>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Choose columns"
          closeOnSelect={false}
          selectionMode="multiple"
          selectedKeys={visibleColumns}
          onSelectionChange={(keys) => {
            const next = new Set(Array.from(keys).map(String));
            next.add("store");
            setVisibleColumns(next);
          }}
        >
          {COLUMNS.filter((column) => column.key !== "store").map((column) => (
            <DropdownItem key={column.key}>{column.label}</DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );

  return (
    <div>
      {tabRow()}

      {api.error ? (
        <ErrorState title="Couldn't load integration health." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : (
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

          <TableCard<ProviderRow>
            title="By provider"
            aria-label="Installations by provider"
            columns={providerColumns}
            rows={data?.byProvider ?? []}
            getRowKey={(row) => row.provider}
            isLoading={api.loading}
            emptyContent={<NoDataEmpty />}
            renderCell={(row, key) => {
              switch (key) {
                case "provider": {
                  const label = getAppProviderLabel(row.provider);
                  return (
                    <span className="flex min-w-0 items-center gap-2">
                      <LogoTile name={label} />
                      <span className="truncate font-medium text-fg">{label}</span>
                    </span>
                  );
                }
                case "count":
                  return <span className="num">{formatCount(row.count)}</span>;
                case "errors":
                  return <span className={cx("num", row.errors > 0 && toneTextClasses.danger)}>{formatCount(row.errors)}</span>;
                default:
                  return null;
              }
            }}
          />

          <DataTable<IntegrationHealthRow>
            aria-label="Installed apps"
            columns={COLUMNS}
            visibleColumns={visibleColumns}
            rows={rows}
            getRowKey={(row) => row.connectionId}
            renderCell={renderCell}
            isLoading={api.loading}
            rowHeight="tall"
            stickyFirstColumn
            onRowAction={(row) => navigate(storeHref(row.tenantId))}
            toolbar={toolbar}
            chips={applied.length ? <AppliedFilters items={applied} onClearAll={clearAll} /> : null}
            footer={
              <TablePagination
                page={table.page}
                pageSize={table.pageSize}
                total={total}
                onPageChange={table.setPage}
                onPageSizeChange={table.setPageSize}
                isDisabled={api.loading}
              />
            }
            emptyContent={
              hasFilters ? (
                <EmptyState
                  kind="no-results"
                  icon={IconApps}
                  title="No results"
                  description="Try a different search or clear the filters."
                  action={
                    <Button variant="tertiary" size="sm" onPress={clearAll}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={IconApps}
                  title="No installations yet"
                  description="Apps that stores install appear here with their connection health."
                />
              )
            }
          />
        </div>
      )}

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={groups}
        value={filterValues}
        onApply={(values) =>
          table.setParams({
            provider: typeof values.provider === "string" && values.provider ? values.provider : undefined,
            type: typeof values.type === "string" && values.type ? values.type : undefined,
            status: typeof values.status === "string" && values.status ? values.status : undefined,
          })
        }
        onClear={() => table.setParams({ provider: undefined, type: undefined, status: undefined })}
      />
    </div>
  );
}
