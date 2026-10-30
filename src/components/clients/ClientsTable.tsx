import { useMemo, useState, type Key } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Client, Subscription } from "../../types";
import { getPlanLabel } from "../../lib/display-labels.util";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { getStoreHealth } from "../../lib/storeHealth";
import { ownerContactGaps } from "../../lib/owner-contact.util";
import {
  normaliseLifecycleKey,
  paymentState,
  STORE_LIFECYCLE_FILTERS,
  storeLifecycle,
  storeLifecycleLabel,
} from "../../lib/storeStatus";
import { clientPlanLabel, planFilterOptions } from "../../lib/plan-identity.util";
import {
  compareByHealthThenDue,
  healthBandEnum,
  isStoreTab,
  joinParam,
  matchesFilters,
  matchesTab,
  splitParam,
  storeTabEnum,
  type HealthBandKey,
  type StoreFilters,
  type StoreTab,
} from "../../lib/store-table.util";
import { useAtRiskStoreCount } from "../../hooks/use-at-risk-store-count";
import { useUrlSearch } from "../../hooks/use-url-search";
import { AppliedFilters, type AppliedFilterItem } from "../common/AppliedFilters";
import { FilterEmpty } from "../common/FilterEmpty";
import { TableToolbar } from "../common/TableToolbar";
import { RenewalBadge } from "../common/RenewalBadge";
import { StoreHealthCell } from "../common/StoreHealthCell";
import {
  Button as UiButton,
  Chip,
  DataTable,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  EmptyState,
  IconButton,
  Select,
  SelectItem,
  Tab,
  TabLabel,
  Tabs,
  TablePagination,
  cx,
  formatMoney,
  menuItemDangerClasses,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
  type TableSort,
} from "../ui";
import { DEFAULT_PAGE_SIZE } from "../ui/TablePagination";
import { IconLogin, IconMore, IconStore } from "../ui/icons";
import { AtRiskStoresTable } from "./AtRiskStoresTable";
import { RemovedStoresTable, useDeletedStoreCount } from "./RemovedStoresPanel";
import { StoreActionDialog, type StoreAction } from "./storeActions";
import { logInToStore } from "./storeLogin";
import { emptyStates } from "../../copy";

export type { StoreTab } from "../../lib/store-table.util";

export interface ClientsTableProps {
  clients: Client[];
  isLoading?: boolean;
  /** Home: show only the first N rows and a "View all stores" link instead of pagination. */
  previewLimit?: number;
  /** Stores page: offer the optional columns (Plan, Renewal) through Columns. */
  allowColumnChoice?: boolean;
  /**
   * Stores page: tab, search, filters, sort and page live in the URL (docs/design/09-settings-and-scale.md
   * §3.1, §3.7). Home's preview keeps them on the page instead.
   */
  syncUrl?: boolean;
}

type ColumnKey =
  | "storeName"
  | "status"
  | "payment"
  | "storeHealth"
  | "sales"
  | "mrr"
  | "plan"
  | "renewalDate"
  | "actions";

const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date());

const allColumns: DataTableColumn[] = [
  { key: "storeName", label: "Store", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "payment", label: `${monthName} payment`, sortable: true },
  { key: "storeHealth", label: "Health", sortable: true },
  { key: "sales", label: "Store sales · 30d", align: "end", sortable: true },
  { key: "mrr", label: "Monthly fee", align: "end", sortable: true },
  { key: "plan", label: "Plan", sortable: true },
  { key: "renewalDate", label: "Renewal", sortable: true },
];

const tableColumns: DataTableColumn[] = [...allColumns, { key: "actions", label: "Actions", hideLabel: true }];

/** Shown by default; Plan and Renewal are optional columns (docs/design/04-super-admin.md §3.3). */
const defaultColumnKeys: ColumnKey[] = ["storeName", "status", "payment", "storeHealth", "sales", "mrr"];


/** A status filter chip's label (legacy `active` reads as Live). */
function statusFilterLabel(value: string): string {
  const key = normaliseLifecycleKey(value);
  return key ? storeLifecycleLabel(key) : value;
}

const healthLabels: Record<HealthBandKey, string> = {
  [healthBandEnum.HEALTHY]: "Healthy",
  [healthBandEnum.AT_RISK]: "At risk",
  [healthBandEnum.CRITICAL]: "Critical",
};

/**
 * Status tabs (owner 2026-10-28: only the needed ones). Set up and Overdue are in Filter (Status, Payment
 * overdue); older links to a dropped view (Set up, Overdue, Trials ending this week) still work and show that
 * tab while it is open. At risk (PRD-025 FR-6.5, the server's view) and Deleted are on the Stores page only.
 */
const tabItems: { key: StoreTab; label: string }[] = [
  { key: storeTabEnum.ALL, label: "All" },
  { key: storeTabEnum.LIVE, label: "Live" },
  { key: storeTabEnum.TRIAL, label: "Trial" },
  { key: storeTabEnum.UNPAID, label: "Unpaid" },
  { key: storeTabEnum.SUSPENDED, label: "Suspended" },
];

const legacyTabItems: { key: StoreTab; label: string }[] = [
  { key: storeTabEnum.SET_UP, label: "Set up" },
  { key: storeTabEnum.OVERDUE, label: "Overdue" },
  { key: storeTabEnum.TRIALS_WEEK, label: "Trials ending this week" },
];

/** PRD-025 FR-6.5: the server's view (`platformStoresAtRisk`); its count is the API's totalCount. */
const atRiskTabItem = { key: storeTabEnum.AT_RISK, label: "At risk" };

const deletedTabItem = { key: storeTabEnum.DELETED, label: "Deleted" };

/** The 200-row list is filtered and paged here, one shared page size (10) like every table. */
const PAGE_SIZE = DEFAULT_PAGE_SIZE;

// "Log in" stays on screen on every row width: the actions column is pinned to the right edge.
const pinnedActions =
  "[&_th:last-child]:sticky [&_th:last-child]:right-0 [&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10 [&_td:last-child]:bg-surface";

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

function compareClients(a: Client, b: Client, column: string, byClientId: Map<string, Subscription>): number {
  switch (column) {
    case "payment":
    case "renewalDate":
      return (byClientId.get(a.id)?.renewalDate ?? "").localeCompare(byClientId.get(b.id)?.renewalDate ?? "");
    case "storeHealth":
      return getStoreHealth(a).score - getStoreHealth(b).score;
    case "sales":
      return a.revenue - b.revenue;
    case "mrr":
      return a.mrr - b.mrr;
    default: {
      const left = a[column as keyof Client];
      const right = b[column as keyof Client];
      return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    }
  }
}

/** The "All …" option of a filter select (an empty filter). */
const ALL = "__all";

/** One select in the Filter popover, like Collections: "All …" first, applied on pick. */
function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: { key: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      label={label}
      size="sm"
      selectedKeys={new Set([value || ALL])}
      onSelectionChange={(keys) => {
        const next = String(Array.from(keys)[0] ?? ALL);
        onChange(next === ALL ? "" : next);
      }}
      disallowEmptySelection
      items={[{ key: ALL, label: allLabel }, ...options]}
    >
      {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
    </Select>
  );
}

// ─── State: the URL on the Stores page, local on Home ────────────────────────

interface StoresTableState {
  tab: StoreTab;
  search: string;
  filters: StoreFilters;
  sort?: TableSort;
  page: number;
  pageSize: number;
  setTab: (tab: StoreTab) => void;
  setSearch: (search: string) => void;
  setFilters: (patch: Partial<StoreFilters>) => void;
  setSort: (sort: TableSort) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearAll: () => void;
}

const NO_FILTERS: StoreFilters = { plans: [], statuses: [], health: [], overdue: false };

function useStoresTableState(syncUrl: boolean): StoresTableState {
  const url = useTableUrlState({ defaultPageSize: PAGE_SIZE });
  const [local, setLocal] = useState<{
    tab: StoreTab;
    search: string;
    filters: StoreFilters;
    sort?: TableSort;
    page: number;
  }>({ tab: storeTabEnum.ALL, search: "", filters: NO_FILTERS, page: 1 });

  if (!syncUrl) {
    return {
      ...local,
      pageSize: PAGE_SIZE,
      setTab: (tab) => setLocal((s) => ({ ...s, tab, page: 1 })),
      setSearch: (search) => setLocal((s) => ({ ...s, search, page: 1 })),
      setFilters: (patch) => setLocal((s) => ({ ...s, filters: { ...s.filters, ...patch }, page: 1 })),
      setSort: (sort) => setLocal((s) => ({ ...s, sort, page: 1 })),
      setPage: (page) => setLocal((s) => ({ ...s, page })),
      setPageSize: () => undefined,
      clearAll: () => setLocal({ tab: storeTabEnum.ALL, search: "", filters: NO_FILTERS, page: 1 }),
    };
  }

  // Older links (Home › Needs attention, the brief) open a tab with ?status=unpaid.
  const statusParam = splitParam(url.filters.status);
  const legacyTab = statusParam.length === 1 && statusParam[0] === "unpaid" ? storeTabEnum.UNPAID : undefined;
  const tab = isStoreTab(url.filters.tab) ? url.filters.tab : (legacyTab ?? storeTabEnum.ALL);
  const filters: StoreFilters = {
    plans: splitParam(url.filters.plan),
    statuses: legacyTab ? [] : statusParam,
    health: splitParam(url.filters.health) as HealthBandKey[],
    overdue: url.filters.overdue === "1",
  };

  return {
    tab,
    search: url.search,
    filters,
    sort: url.sort,
    page: url.page,
    pageSize: url.pageSize,
    // One URL write: drops the legacy ?status=unpaid together with setting the tab.
    setTab: (next) =>
      url.setParams({
        tab: next === storeTabEnum.ALL ? undefined : next,
        ...(legacyTab ? { status: undefined } : {}),
      }),
    setSearch: url.setSearch,
    setFilters: (patch) => {
      if (patch.plans) url.setFilter("plan", joinParam(patch.plans));
      if (patch.statuses) url.setFilter("status", joinParam(patch.statuses));
      if (patch.health) url.setFilter("health", joinParam(patch.health));
      if (patch.overdue !== undefined) url.setFilter("overdue", patch.overdue ? "1" : undefined);
    },
    setSort: url.setSort,
    setPage: url.setPage,
    setPageSize: url.setPageSize,
    clearAll: url.clearFilters,
  };
}

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * The stores table card (docs/design/04-super-admin.md §3.1, §3.3; 09 §3.7): status tabs and saved views,
 * search, Filter and Columns on one row; Store · Status · {Month} payment · Health · Store sales · 30d ·
 * Monthly fee; a visible "Log in" and a "···" menu per row. Default order: health, then billing due date.
 * Used by Home (first rows + "View all stores") and the Stores page (50 per page, state in the URL).
 */
export function ClientsTable({
  clients,
  isLoading,
  previewLimit,
  allowColumnChoice = false,
  syncUrl = false,
}: ClientsTableProps) {
  const navigate = useNavigate();
  const { subscriptions, plans } = useClients();
  // PRD-024 FR-1.3 (B-08): plan options and labels from platformPlans, by version id.
  const planOptions = useMemo(() => planFilterOptions(plans), [plans]);
  const planLabelById = useMemo(() => new Map(planOptions.map((option) => [option.key, option.label])), [planOptions]);
  const { can, user } = useAuth();
  // Client-side mirror of the backend guard (review C-M5): the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  // Q10 / PRD-018 FR-2.1: only the platform owner deletes a store.
  const canDelete = canManage && user?.role === "PLATFORM_OWNER";
  const state = useStoresTableState(syncUrl);
  const { filters, sort } = state;
  // The server-list tabs (At risk, Deleted) live on the Stores page (syncUrl) only.
  const showServerTabs = syncUrl;
  const isServerTab = state.tab === storeTabEnum.DELETED || state.tab === storeTabEnum.AT_RISK;
  const tab = !showServerTabs && isServerTab ? storeTabEnum.ALL : state.tab;
  const deletedCount = useDeletedStoreCount(!showServerTabs);
  const atRiskCount = useAtRiskStoreCount(!showServerTabs);
  const shownTabs = useMemo(
    () => [
      ...tabItems,
      ...legacyTabItems.filter((item) => item.key === tab),
      ...(showServerTabs ? [atRiskTabItem, deletedTabItem] : []),
    ],
    [showServerTabs, tab],
  );
  const [searchInput, setSearchInput] = useUrlSearch(state.search, state.setSearch);
  const [savedColumns, setSavedColumns] = usePersistentColumns("stores", defaultColumnKeys);
  const [pending, setPending] = useState<{ client: Client; action: StoreAction } | null>(null);
  const now = useMemo(() => new Date(), []);

  const visibleColumns = useMemo(
    () => new Set([...(allowColumnChoice ? savedColumns : defaultColumnKeys), "actions"]),
    [allowColumnChoice, savedColumns],
  );

  const subscriptionByClientId = useMemo(() => latestSubscriptionByClient(subscriptions), [subscriptions]);

  // Search and Filter apply first; the tab counts are taken from that set.
  const query = state.search.trim().toLowerCase();
  const searched = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.storeName.toLowerCase().includes(query) ||
        client.ownerEmail.toLowerCase().includes(query) ||
        client.ownerName.toLowerCase().includes(query);
      return matchesSearch && matchesFilters(filters, client, subscriptionByClientId.get(client.id));
    });
    // filters is rebuilt from the URL each render; its parts are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, query, subscriptionByClientId, filters.plans.join(), filters.statuses.join(), filters.health.join(), filters.overdue]);

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(shownTabs.map((item) => [item.key, 0])) as Record<StoreTab, number>;
    searched.forEach((client) => {
      const sub = subscriptionByClientId.get(client.id);
      shownTabs.forEach(({ key }) => {
        if (matchesTab(key, client, sub, now)) counts[key] += 1;
      });
    });
    return counts;
  }, [now, searched, shownTabs, subscriptionByClientId]);

  const sorted = useMemo(() => {
    const items = searched.filter((client) => matchesTab(tab, client, subscriptionByClientId.get(client.id), now));
    if (!sort) return items.sort((a, b) => compareByHealthThenDue(a, b, subscriptionByClientId));
    items.sort((a, b) => compareClients(a, b, sort.column, subscriptionByClientId));
    return sort.direction === "desc" ? items.reverse() : items;
  }, [now, searched, sort, subscriptionByClientId, tab]);

  const pageSize = previewLimit ?? state.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = previewLimit ? 1 : Math.min(state.page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [pageSize, safePage, sorted]);

  const hasFilters =
    query !== "" ||
    filters.plans.length > 0 ||
    filters.statuses.length > 0 ||
    filters.health.length > 0 ||
    filters.overdue;
  const clearFilters = () => {
    setSearchInput("");
    state.clearAll();
  };

  const applied: AppliedFilterItem[] = [
    ...filters.plans.map((plan) => ({
      key: `plan-${plan}`,
      label: `Plan: ${planLabelById.get(plan) ?? getPlanLabel(plan)}`,
      onRemove: () => state.setFilters({ plans: filters.plans.filter((p) => p !== plan) }),
    })),
    ...filters.statuses.map((status) => ({
      key: `status-${status}`,
      label: `Status: ${statusFilterLabel(status)}`,
      onRemove: () => state.setFilters({ statuses: filters.statuses.filter((s) => s !== status) }),
    })),
    ...filters.health.map((band) => ({
      key: `health-${band}`,
      label: `Health: ${healthLabels[band] ?? band}`,
      onRemove: () => state.setFilters({ health: filters.health.filter((h) => h !== band) }),
    })),
    ...(filters.overdue
      ? [{ key: "overdue", label: "Payment overdue", onRemove: () => state.setFilters({ overdue: false }) }]
      : []),
  ];

  const onMenuAction = (client: Client, key: Key) => {
    switch (String(key)) {
      case "view":
        navigate(`/stores/${client.id}`);
        break;
      case "suspend":
      case "reactivate":
      case "delete":
        setPending({ client, action: String(key) as StoreAction });
        break;
    }
  };

  const renderCell = (client: Client, key: string) => {
    const subscription = subscriptionByClientId.get(client.id);

    switch (key as ColumnKey) {
      case "storeName":
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-label font-medium text-fg-muted"
            >
              {initials(client.storeName)}
            </span>
            <div className="min-w-0 max-w-64">
              <p className="truncate font-medium text-fg">{client.storeName}</p>
              {/* PRD-024 FR-4.4: no owner email reads "—" (owner 2026-10-28: no chip; the store page has the banner). */}
              <p className="truncate text-caption text-fg-subtle">
                {ownerContactGaps(client).isMissingEmail ? "—" : client.ownerEmail}
              </p>
            </div>
          </div>
        );
      case "status": {
        const lifecycle = storeLifecycle(client);
        return <Chip tone={lifecycle.tone}>{lifecycle.label}</Chip>;
      }
      case "payment": {
        const payment = paymentState(subscription);
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Chip tone={payment.tone}>{payment.label}</Chip>
            {payment.detail ? <span className="text-caption text-fg-muted">{payment.detail}</span> : null}
          </div>
        );
      }
      case "storeHealth":
        return <StoreHealthCell client={client} />;
      case "sales":
        return client.revenue > 0 ? (
          <span className="num">{formatMoney(client.revenue, { whole: true })}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      case "mrr":
        return <span className="num">{formatMoney(client.mrr, { whole: true })}</span>;
      case "plan":
        return <span>{clientPlanLabel(client)}</span>;
      case "renewalDate":
        return <RenewalBadge subscription={subscription} />;
      case "actions": {
        const isSuspended = client.status === "suspended";
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {canImpersonate ? (
              <UiButton
                variant="secondary"
                size="sm"
                startIcon={<IconLogin aria-hidden />}
                onPress={() => void logInToStore(client)}
              >
                Log in
              </UiButton>
            ) : null}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <IconButton aria-label={`More actions for ${client.storeName}`} size="sm" showTooltip={false}>
                  <IconMore aria-hidden className="size-4" />
                </IconButton>
              </DropdownTrigger>
              <DropdownMenu aria-label={`Actions for ${client.storeName}`} onAction={(actionKey) => onMenuAction(client, actionKey)}>
                <DropdownSection showDivider={canDelete} aria-label="Store">
                  <DropdownItem key="view">View details</DropdownItem>
                  {canManage ? (
                    <DropdownItem key={isSuspended ? "reactivate" : "suspend"}>
                      {isSuspended ? "Reactivate store" : "Suspend store"}
                    </DropdownItem>
                  ) : null}
                </DropdownSection>
                {canDelete ? (
                  <DropdownSection aria-label="Danger">
                    <DropdownItem key="delete" className={menuItemDangerClasses}>
                      Delete store
                    </DropdownItem>
                  </DropdownSection>
                ) : null}
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      }
      default:
        return <span className="text-fg-subtle">—</span>;
    }
  };

  const emptyContent =
    clients.length === 0 ? (
      <EmptyState
        icon={IconStore}
        title={emptyStates.stores.title}
        description={emptyStates.stores.description}
        action={
          canManage ? (
            <UiButton variant="secondary" onPress={() => navigate("/stores/new")}>
              {emptyStates.stores.action}
            </UiButton>
          ) : undefined
        }
      />
    ) : tab === storeTabEnum.UNPAID && !hasFilters ? (
      <EmptyState icon={IconStore} title={emptyStates.unpaid.title} description={emptyStates.unpaid.description} />
    ) : (
      <FilterEmpty things="stores" query={state.search} onClear={clearFilters} />
    );

  const tabsNode = (
    <Tabs
      aria-label="Store views"
      selectedKey={tab}
      onSelectionChange={(key) => state.setTab(String(key) as StoreTab)}
      classNames={{ base: "min-w-0 max-w-full", panel: "hidden" }}
    >
      {shownTabs.map((item) => (
        <Tab
          key={item.key}
          title={
            <TabLabel
              label={item.label}
              count={
                item.key === storeTabEnum.DELETED
                  ? deletedCount
                  : item.key === storeTabEnum.AT_RISK
                    ? atRiskCount
                    : tabCounts[item.key]
              }
            />
          }
        />
      ))}
    </Tabs>
  );

  // PRD-018 FR-2.3, FR-2.5: deleted (restorable) and purged stores, in the same table card.
  if (tab === storeTabEnum.DELETED) return <RemovedStoresTable tabs={tabsNode} />;

  // PRD-025 FR-6.5: the server's at-risk list, paged by `totalCount`, in the same table card.
  if (tab === storeTabEnum.AT_RISK) return <AtRiskStoresTable tabs={tabsNode} page={state.page} onPageChange={state.setPage} />;

  const toolbar = (
    <>
      <TableToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search stores or owners"
        columns={
          allowColumnChoice ? allColumns.map((column) => ({ key: column.key, label: String(column.label) })) : undefined
        }
        visibleColumns={allowColumnChoice ? Array.from(savedColumns) : undefined}
        onVisibleColumnsChange={allowColumnChoice ? (keys) => setSavedColumns(new Set(keys)) : undefined}
        tabs={tabsNode}
        // One select per filter, applied on pick, like Collections (owner 2026-10-28).
        filterContent={
          <>
            <FilterSelect
              label="Plan"
              allLabel="All plans"
              value={filters.plans[0]}
              options={planOptions}
              onChange={(value) => state.setFilters({ plans: value ? [value] : [] })}
            />
            <FilterSelect
              label="Status"
              allLabel="Any status"
              value={filters.statuses[0]}
              options={STORE_LIFECYCLE_FILTERS.map((statusOption) => ({
                key: statusOption,
                label: storeLifecycleLabel(statusOption),
              }))}
              onChange={(value) => state.setFilters({ statuses: value ? [value] : [] })}
            />
            <FilterSelect
              label="Health"
              allLabel="Any health"
              value={filters.health[0]}
              options={(Object.keys(healthLabels) as HealthBandKey[]).map((band) => ({ key: band, label: healthLabels[band] }))}
              onChange={(value) => state.setFilters({ health: value ? [value as HealthBandKey] : [] })}
            />
            <FilterSelect
              label="Payment"
              allLabel="Any payment"
              value={filters.overdue ? "overdue" : undefined}
              options={[{ key: "overdue", label: "Payment overdue" }]}
              onChange={(value) => state.setFilters({ overdue: value === "overdue" })}
            />
          </>
        }
      />
      <AppliedFilters items={applied} onClearAll={clearFilters} />
    </>
  );

  const footer =
    !isLoading && sorted.length > 0 ? (
      previewLimit ? (
        <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-4 py-3">
          <p className="text-caption text-fg-muted num">
            Showing {pageItems.length} of {sorted.length} {sorted.length === 1 ? "store" : "stores"}
          </p>
          <Link to="/stores" className="text-label font-medium text-brand hover:underline">
            View all stores
          </Link>
        </div>
      ) : (
        <TablePagination
          page={safePage}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={state.setPage}
          onPageSizeChange={syncUrl ? state.setPageSize : undefined}
        />
      )
    ) : null;

  return (
    <>
      <DataTable
        aria-label="Stores"
        columns={tableColumns}
        visibleColumns={visibleColumns}
        rows={pageItems}
        getRowKey={(client) => client.id}
        renderCell={renderCell}
        isLoading={isLoading}
        toolbar={toolbar}
        footer={footer}
        sort={sort}
        onSortChange={state.setSort}
        onRowAction={(client) => navigate(`/stores/${client.id}`)}
        stickyFirstColumn
        scrollClassName={cx(pinnedActions, !previewLimit && "max-h-[70vh]")}
        emptyContent={emptyContent}
      />
      <StoreActionDialog client={pending?.client ?? null} action={pending?.action ?? null} onClose={() => setPending(null)} />
    </>
  );
}
