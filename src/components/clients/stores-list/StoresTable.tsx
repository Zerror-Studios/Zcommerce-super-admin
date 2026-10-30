/**
 * The Stores table card (04 S-02): status switch with counts, search, Filter (drawer) and Columns on one row;
 * Store · Plan · Status · <Month> payment · Health · Sales · 30d · Monthly fee · ⋯. Every action, Log in to store
 * first, is in the row's ⋯ menu. Needs-action rows come first. Tab, search, filters, sort and page live in the URL.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Client, Subscription } from "../../../types";
import { useUrlSearch } from "../../../hooks/use-url-search";
import { PLATFORM_PERMISSIONS } from "../../../lib/permissions";
import { planFilterOptions } from "../../../lib/plan-identity.util";
import {
  healthBandEnum,
  isStoreTab,
  joinParam,
  matchesTab,
  splitParam,
  storeTabEnum,
  type HealthBandKey,
  type StoreTab,
} from "../../../lib/store-table.util";
import {
  STORE_LIFECYCLE_FILTERS,
  graceDaysFor,
  normaliseLifecycleKey,
  storeLifecycleEnum,
  storeLifecycleKey,
  storeLifecycleLabel,
} from "../../../lib/storeStatus";
import { latestSubscriptionByClient } from "../../../lib/subscription-lookup.util";
import { formatDate } from "../../../lib/utils";
import { useAuth } from "../../../providers/AuthProvider";
import { useClients } from "../../../providers/ClientsProvider";
import { usePlatformSettings } from "../../../providers/SettingsProvider";
import { AppliedFilters, type AppliedFilterItem } from "../../common/AppliedFilters";
import {
  Avatar,
  Button,
  Chip,
  DataTable,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  EmptyState,
  FilterButton,
  FilterDrawer,
  IconButton,
  SegmentedSwitch,
  TablePagination,
  formatMoney,
  toast,
  toastError,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
  type RowMenuItem,
} from "../../ui";
import {
  IconAdd,
  IconColumns,
  IconDelete,
  IconEdit,
  IconLink,
  IconLogin,
  IconPause,
  IconPayments,
  IconPlay,
  IconSend,
  IconStore,
} from "../../ui/icons";
import { useDeletedStoreCount } from "../RemovedStoresPanel";
import { StoreActionDialog, type StoreAction } from "../storeActions";
import { logInToStore } from "../storeLogin";
import { DeletedStoresTable } from "./DeletedStoresTable";
import { SendReminderDialog } from "./SendReminderDialog";
import { StoreHealthBar } from "./StoreHealthBar";
import { StoresToolbar } from "./StoresToolbar";
import {
  HEALTH_LABELS,
  JOINED_OPTIONS,
  PAYMENT_FILTER_OPTIONS,
  RENEWS_OPTIONS,
  compareByColumn,
  compareNeedsAction,
  countFilters,
  isPaymentOwed,
  matchesListFilters,
  matchesSearch,
  paymentBadge,
  paymentKindEnum,
  planShortName,
  storeStatusBadge,
  type PaymentBadge,
  type PaymentKind,
  type StoreListFilters,
} from "./store-list.util";

// ─── Columns ──────────────────────────────────────────────────────────────

const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date());

/** Fixed widths 756px → Store gets 204px at 960px; "tablet: hide" columns go under 956px (DataTable). */
const columns: DataTableColumn[] = [
  { key: "store", label: "Store", sortable: true, skeleton: "avatar", mobile: "primary" },
  { key: "plan", label: "Plan", width: 100, hideWhen: "narrow", sortable: true },
  { key: "status", label: "Status", width: 130, sortable: true, skeleton: "badge", mobile: "badge" },
  { key: "payment", label: `${monthName} payment`, width: 140, sortable: true, skeleton: "badge" },
  { key: "health", label: "Health", width: 110, hideWhen: "narrow", sortable: true },
  { key: "sales", label: "Sales · 30d", width: 120, sortable: true },
  { key: "fee", label: "Monthly fee", width: 100, hideWhen: "narrow", sortable: true },
  // Optional (Columns menu, off by default), as live.
  { key: "renewalDate", label: "Renewal", width: 130, hideWhen: "narrow", sortable: true },
];

const OPTIONAL_COLUMNS = columns.filter((column) => column.key !== "store");
const DEFAULT_COLUMNS = ["plan", "status", "payment", "health", "sales", "fee"];

// ─── Tabs ─────────────────────────────────────────────────────────────────

const TABS: { value: StoreTab; label: string }[] = [
  { value: storeTabEnum.ALL, label: "All" },
  { value: storeTabEnum.LIVE, label: "Live" },
  { value: storeTabEnum.TRIAL, label: "Trial" },
  { value: storeTabEnum.UNPAID, label: "Unpaid" },
  { value: storeTabEnum.SUSPENDED, label: "Suspended" },
  { value: storeTabEnum.DELETED, label: "Deleted" },
];

const EMPTY_BY_TAB: Partial<Record<StoreTab, { title: string; description: string }>> = {
  [storeTabEnum.LIVE]: { title: "No live stores yet", description: "Stores show here once they go live." },
  [storeTabEnum.TRIAL]: { title: "No stores in trial", description: "Stores on a free trial show here." },
  [storeTabEnum.UNPAID]: { title: "Everyone's paid", description: "No store owes a payment right now." },
  [storeTabEnum.SUSPENDED]: {
    title: "No suspended stores",
    description: "Suspended stores stay here until they're reactivated or deleted.",
  },
};

const PAYMENT_KINDS = new Set<string>(Object.values(paymentKindEnum));
const HEALTH_KEYS = new Set<string>(Object.values(healthBandEnum));

// ─── URL state ────────────────────────────────────────────────────────────

interface Row {
  client: Client;
  subscription?: Subscription;
  payment: PaymentBadge;
}

/**
 * Tab and filters from the URL. Older links keep working: `?status=unpaid` opens Unpaid, `?overdue=1` and
 * `?tab=overdue` filter overdue payments, `?tab=setup` filters Set up, `?tab=trials-week` opens Trial renewing
 * within 7 days.
 */
function readUrl(params: Record<string, string>): { tab: StoreTab; filters: StoreListFilters; legacy: string[] } {
  const legacy: string[] = [];
  const statusParam = splitParam(params.status);
  let tab: StoreTab = isStoreTab(params.tab) ? params.tab : storeTabEnum.ALL;
  const filters: StoreListFilters = {
    plans: splitParam(params.plan),
    statuses: statusParam,
    health: splitParam(params.health).filter((key) => HEALTH_KEYS.has(key)) as HealthBandKey[],
    payment: splitParam(params.payment).filter((key) => PAYMENT_KINDS.has(key)) as PaymentKind[],
    renews: params.renews === "7" || params.renews === "30" ? params.renews : "",
    joined: JOINED_OPTIONS.some((option) => option.value === params.joined) ? params.joined : "",
  };
  if (statusParam.length === 1 && statusParam[0] === "unpaid") {
    tab = storeTabEnum.UNPAID;
    filters.statuses = [];
    legacy.push("status");
  }
  if (params.overdue === "1") {
    filters.payment = Array.from(new Set([...filters.payment, paymentKindEnum.GRACE, paymentKindEnum.OVERDUE]));
    legacy.push("overdue");
  }
  if (tab === storeTabEnum.OVERDUE) {
    filters.payment = Array.from(new Set([...filters.payment, paymentKindEnum.GRACE, paymentKindEnum.OVERDUE]));
    tab = storeTabEnum.ALL;
    legacy.push("tab");
  } else if (tab === storeTabEnum.SET_UP) {
    filters.statuses = Array.from(new Set([...filters.statuses, storeLifecycleEnum.SET_UP]));
    tab = storeTabEnum.ALL;
    legacy.push("tab");
  } else if (tab === storeTabEnum.TRIALS_WEEK) {
    filters.renews = "7";
    tab = storeTabEnum.TRIAL;
    legacy.push("tab");
  }
  return { tab, filters, legacy };
}

// ─── Table ────────────────────────────────────────────────────────────────

export interface StoresTableProps {
  clients: Client[];
  isLoading?: boolean;
}

export function StoresTable({ clients, isLoading = false }: StoresTableProps) {
  const navigate = useNavigate();
  const { subscriptions, plans } = useClients();
  const { settings } = usePlatformSettings();
  const { can, user } = useAuth();
  // Client-side mirror of the backend guards; the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const canRemind = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canDelete = canManage && user?.role === "PLATFORM_OWNER";

  const url = useTableUrlState();
  const { tab, filters, legacy } = readUrl(url.filters);
  const filtersKey = JSON.stringify(filters);
  const [searchInput, setSearchInput] = useUrlSearch(url.search, url.setSearch);
  const [savedColumns, setSavedColumns] = usePersistentColumns("stores.v2", DEFAULT_COLUMNS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, setPending] = useState<{ client: Client; action: StoreAction } | null>(null);
  const [reminding, setReminding] = useState<Client[]>([]);
  const deletedCount = useDeletedStoreCount(false);
  const now = useMemo(() => new Date(), []);

  const visibleColumns = useMemo(() => new Set(["store", ...savedColumns]), [savedColumns]);

  // Every active plan (custom plans included, so a store on one can be found).
  const planOptions = useMemo(
    () => planFilterOptions(plans.filter((plan) => (plan.status ?? "ACTIVE") === "ACTIVE")),
    [plans],
  );
  const planLabel = useMemo(() => new Map(planOptions.map((option) => [option.key, option.label])), [planOptions]);

  const rows = useMemo<Row[]>(() => {
    const byClient = latestSubscriptionByClient(subscriptions);
    return clients.map((client) => {
      const subscription = byClient.get(client.id);
      return { client, subscription, payment: paymentBadge(subscription, graceDaysFor(client, settings.gracePeriodDays)) };
    });
  }, [clients, settings.gracePeriodDays, subscriptions]);

  // Search and filters apply first; the tab counts are taken from that set.
  const query = url.search.trim().toLowerCase();
  const searched = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesSearch(row.client, query) &&
          matchesListFilters(filters, row.client, row.subscription, row.payment.kind, now),
      ),
    // filtersKey stands for the filters rebuilt from the URL each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query, filtersKey, now],
  );

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<StoreTab, number>> = {};
    TABS.forEach(({ value }) => {
      if (value !== storeTabEnum.DELETED) {
        counts[value] = searched.filter((row) => matchesTab(value, row.client, row.subscription, now)).length;
      }
    });
    return counts;
  }, [now, searched]);

  const sorted = useMemo(() => {
    const items = searched.filter((row) => matchesTab(tab, row.client, row.subscription, now));
    const sort = url.sort;
    if (!sort) return items.sort(compareNeedsAction);
    items.sort((a, b) => compareByColumn(a, b, sort.column));
    return sort.direction === "desc" ? items.reverse() : items;
  }, [now, searched, tab, url.sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / url.pageSize));
  const page = Math.min(url.page, pageCount);
  const pageRows = sorted.slice((page - 1) * url.pageSize, page * url.pageSize);

  // ─── Changing the URL ───────────────────────────────────────────────────

  const legacyCleared = Object.fromEntries(legacy.map((key) => [key, undefined]));
  const writeFilters = (next: StoreListFilters) =>
    url.setParams({
      ...legacyCleared,
      // A legacy tab is written back as the tab it opened.
      ...(legacy.includes("tab") ? { tab: tab === storeTabEnum.ALL ? undefined : tab } : {}),
      plan: joinParam(next.plans),
      status: joinParam(next.statuses),
      health: joinParam(next.health),
      payment: joinParam(next.payment),
      renews: next.renews || undefined,
      joined: next.joined || undefined,
    });
  const setTab = (next: StoreTab) =>
    url.setParams({
      tab: next === storeTabEnum.ALL ? undefined : next,
      ...(legacy.includes("status") ? { status: undefined } : {}),
    });
  const clearFilters = () => {
    setSearchInput("");
    url.setParams({
      q: undefined,
      ...legacyCleared,
      ...(legacy.includes("tab") ? { tab: tab === storeTabEnum.ALL ? undefined : tab } : {}),
      plan: undefined,
      status: undefined,
      health: undefined,
      payment: undefined,
      renews: undefined,
      joined: undefined,
    });
  };

  // ─── Filter drawer ──────────────────────────────────────────────────────

  const groups = useMemo<FilterGroup[]>(
    () => [
      ...(planOptions.length
        ? [{ key: "plan", label: "Plan", type: "options" as const, options: planOptions.map((o) => ({ value: o.key, label: o.label })) }]
        : []),
      {
        key: "status",
        label: "Status",
        type: "options",
        options: STORE_LIFECYCLE_FILTERS.map((key) => ({ value: key, label: storeLifecycleLabel(key) })),
      },
      {
        key: "health",
        label: "Health",
        type: "options",
        options: (Object.keys(HEALTH_LABELS) as HealthBandKey[]).map((key) => ({ value: key, label: HEALTH_LABELS[key] })),
      },
      { key: "payment", label: "Payment", type: "options", options: PAYMENT_FILTER_OPTIONS },
      { key: "renews", label: "Renews", type: "single", options: RENEWS_OPTIONS },
      { key: "joined", label: "Joined", type: "date", options: JOINED_OPTIONS },
    ],
    [planOptions],
  );

  const drawerValue = useMemo<FilterValues>(
    () => ({
      plan: filters.plans,
      status: filters.statuses,
      health: filters.health,
      payment: filters.payment,
      renews: filters.renews,
      joined: filters.joined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
  );

  const fromDrawer = (values: FilterValues): StoreListFilters => {
    const list = (key: string) => (Array.isArray(values[key]) ? (values[key] as string[]) : []);
    const one = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
    return {
      plans: list("plan"),
      statuses: list("status"),
      health: list("health") as HealthBandKey[],
      payment: list("payment") as PaymentKind[],
      renews: one("renews"),
      joined: one("joined"),
    };
  };

  const countResults = (draft: FilterValues) => {
    const next = fromDrawer(draft);
    return rows.filter(
      (row) =>
        matchesSearch(row.client, query) &&
        matchesListFilters(next, row.client, row.subscription, row.payment.kind, now) &&
        matchesTab(tab, row.client, row.subscription, now),
    ).length;
  };

  const statusLabel = (value: string) => {
    const key = normaliseLifecycleKey(value);
    return key ? storeLifecycleLabel(key) : value;
  };
  const optionLabel = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const chips: AppliedFilterItem[] = [
    ...filters.plans.map((plan) => ({
      key: `plan-${plan}`,
      label: `Plan: ${planLabel.get(plan) ?? plan}`,
      onRemove: () => writeFilters({ ...filters, plans: filters.plans.filter((p) => p !== plan) }),
    })),
    ...filters.statuses.map((status) => ({
      key: `status-${status}`,
      label: `Status: ${statusLabel(status)}`,
      onRemove: () => writeFilters({ ...filters, statuses: filters.statuses.filter((s) => s !== status) }),
    })),
    ...filters.health.map((band) => ({
      key: `health-${band}`,
      label: `Health: ${HEALTH_LABELS[band]}`,
      onRemove: () => writeFilters({ ...filters, health: filters.health.filter((h) => h !== band) }),
    })),
    ...filters.payment.map((kind) => ({
      key: `payment-${kind}`,
      label: `Payment: ${optionLabel(PAYMENT_FILTER_OPTIONS, kind)}`,
      onRemove: () => writeFilters({ ...filters, payment: filters.payment.filter((p) => p !== kind) }),
    })),
    ...(filters.renews
      ? [{ key: "renews", label: `Renews: ${optionLabel(RENEWS_OPTIONS, filters.renews).toLowerCase()}`, onRemove: () => writeFilters({ ...filters, renews: "" }) }]
      : []),
    ...(filters.joined
      ? [{ key: "joined", label: `Joined: ${optionLabel(JOINED_OPTIONS, filters.joined).toLowerCase()}`, onRemove: () => writeFilters({ ...filters, joined: "" }) }]
      : []),
  ];

  // ─── Rows ───────────────────────────────────────────────────────────────

  const copyStoreLink = (client: Client) => {
    if (!client.domain) return;
    void navigator.clipboard
      ?.writeText(`https://${client.domain}`)
      .then(() => toast.success("Store link copied"))
      .catch(() => toastError("Couldn't copy the store link."));
  };

  const rowActions = (row: Row): RowMenuItem[] => {
    const { client } = row;
    const suspended = storeLifecycleKey(client) === storeLifecycleEnum.SUSPENDED;
    const items: RowMenuItem[] = [];
    if (canImpersonate) {
      items.push({ key: "login", label: "Log in to store", icon: IconLogin, onSelect: () => void logInToStore(client) });
    }
    items.push({
      key: "subscription",
      label: "View subscription",
      icon: IconPayments,
      onSelect: () => navigate(`/stores/${client.id}/billing?from=subscriptions`),
    });
    if (canRemind && isPaymentOwed(row.payment.kind)) {
      items.push({ key: "remind", label: "Send reminder", icon: IconSend, onSelect: () => setReminding([client]) });
    }
    if (canManage) {
      items.push({
        key: "edit",
        label: "Edit store details",
        icon: IconEdit,
        onSelect: () => navigate(`/stores/${client.id}/details?edit=1`),
      });
    }
    items.push({
      key: "copy",
      label: "Copy store link",
      icon: IconLink,
      disabled: !client.domain,
      description: client.domain ? undefined : "No storefront domain yet",
      onSelect: () => copyStoreLink(client),
    });
    if (canManage) {
      items.push(
        suspended
          ? { key: "reactivate", label: "Reactivate store", icon: IconPlay, onSelect: () => setPending({ client, action: "reactivate" }) }
          : {
              key: "suspend",
              label: "Suspend store",
              icon: IconPause,
              destructive: true,
              onSelect: () => setPending({ client, action: "suspend" }),
            },
      );
    }
    if (canDelete) {
      items.push({
        key: "delete",
        label: "Delete store",
        icon: IconDelete,
        destructive: true,
        onSelect: () => setPending({ client, action: "delete" }),
      });
    }
    return items;
  };

  const salesText = (client: Client) => (client.revenue > 0 ? formatMoney(client.revenue, { whole: true }) : "—");

  const renderCell = (row: Row, key: string) => {
    const { client, payment, subscription } = row;
    switch (key) {
      case "store":
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={client.storeName} size="md" className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-body font-medium text-fg" title={client.storeName}>
                {client.storeName}
              </p>
              {client.slug ? <p className="truncate text-label text-fg-muted">{client.slug}</p> : null}
            </div>
          </div>
        );
      case "plan":
        return <span className="block truncate">{planShortName(client)}</span>;
      case "status": {
        const status = storeStatusBadge(client);
        return <Chip tone={status.tone}>{status.label}</Chip>;
      }
      case "payment":
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Chip tone={payment.tone}>{payment.label}</Chip>
            {payment.detail ? <span className="text-label text-fg-muted num">{payment.detail}</span> : null}
          </div>
        );
      case "health":
        return <StoreHealthBar client={client} />;
      case "sales":
        return client.revenue > 0 ? <span className="num">{salesText(client)}</span> : <span className="text-fg-subtle">—</span>;
      case "fee":
        return client.mrr > 0 ? (
          <span className="num">{formatMoney(client.mrr, { whole: true })}</span>
        ) : (
          <span className="text-fg-muted">No fee</span>
        );
      case "renewalDate":
        return subscription?.renewalDate ? (
          <span className="num">{formatDate(subscription.renewalDate)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      default:
        return null;
    }
  };

  // Phone row (S-02): store name + status badge; "Plus · Due 15 Nov · ₹18,22,511".
  const mobileRow = (row: Row) => {
    const status = storeStatusBadge(row.client);
    const line2 = [planShortName(row.client), row.payment.label, row.client.revenue > 0 ? salesText(row.client) : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 truncate text-body font-medium text-fg">{row.client.storeName}</span>
          <Chip tone={status.tone}>{status.label}</Chip>
        </div>
        <p className="mt-1 truncate text-label text-fg-muted num">{line2}</p>
      </>
    );
  };

  // ─── Toolbar, empty states ──────────────────────────────────────────────

  const tabsNode = (
    <SegmentedSwitch<StoreTab>
      ariaLabel="Store status"
      value={tab}
      onChange={setTab}
      items={TABS.map((item) => ({
        value: item.value,
        label: item.label,
        count: item.value === storeTabEnum.DELETED ? (deletedCount ?? null) : (tabCounts[item.value] ?? 0),
      }))}
    />
  );

  if (tab === storeTabEnum.DELETED) {
    return <DeletedStoresTable tabs={tabsNode} search={searchInput} onSearchChange={setSearchInput} query={url.search} />;
  }

  const activeFilters = countFilters(filters);
  const hasFilters = query !== "" || activeFilters > 0;
  const tabEmpty = EMPTY_BY_TAB[tab];
  const emptyContent = hasFilters ? (
    <EmptyState kind="no-results" title="No stores match these filters" onClearFilters={clearFilters} />
  ) : tab === storeTabEnum.ALL ? (
    <EmptyState
      icon={IconStore}
      title="No stores yet"
      description="Add your first store to start billing it."
      action={
        canManage ? (
          <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
            Add store
          </Button>
        ) : undefined
      }
    />
  ) : (
    <EmptyState icon={IconStore} title={tabEmpty?.title} description={tabEmpty?.description} />
  );

  const toolbar = (
    <StoresToolbar tabs={tabsNode} search={searchInput} onSearchChange={setSearchInput}>
      <FilterButton count={activeFilters} onPress={() => setFiltersOpen(true)} />
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
          selectedKeys={savedColumns}
          onSelectionChange={(keys) => {
            const selected = keys === "all" ? OPTIONAL_COLUMNS.map((column) => column.key) : Array.from(keys).map(String);
            if (selected.length > 0) setSavedColumns(new Set(selected));
          }}
        >
          {OPTIONAL_COLUMNS.map((column) => (
            <DropdownItem key={column.key}>{column.label}</DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </StoresToolbar>
  );

  return (
    <>
      <DataTable
        aria-label="Stores"
        columns={columns}
        visibleColumns={visibleColumns}
        rows={pageRows}
        getRowKey={(row) => row.client.id}
        renderCell={renderCell}
        isLoading={isLoading}
        rowHeight="tall"
        stickyFirstColumn
        toolbar={toolbar}
        chips={<AppliedFilters items={chips} onClearAll={clearFilters} />}
        footer={
          !isLoading && sorted.length > 0 ? (
            <TablePagination
              page={page}
              pageSize={url.pageSize}
              total={sorted.length}
              onPageChange={url.setPage}
              onPageSizeChange={url.setPageSize}
            />
          ) : null
        }
        sort={url.sort}
        onSortChange={url.setSort}
        onRowAction={(row) => navigate(`/stores/${row.client.id}/overview`)}
        rowActions={rowActions}
        rowActionsLabel={(row) => `Actions for ${row.client.storeName}`}
        mobileRow={mobileRow}
        emptyContent={emptyContent}
      />

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={groups}
        value={drawerValue}
        onApply={(values) => writeFilters(fromDrawer(values))}
        countResults={countResults}
      />

      <StoreActionDialog client={pending?.client ?? null} action={pending?.action ?? null} onClose={() => setPending(null)} />
      <SendReminderDialog
        key={reminding.map((store) => store.id).join()}
        stores={reminding}
        onClose={() => setReminding([])}
      />
    </>
  );
}
