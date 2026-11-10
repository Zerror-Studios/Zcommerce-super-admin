/**
 * The Stores list (design v2 §1A "SA Stores", §4.3, §4.4, §7; board 59-SA-Stores-Table). Table only, no cards view.
 *
 * Title row (from the page, with this table's ⋯: Export, Choose columns, Deleted stores) → summary panel (from
 * the page) → the toolbar ABOVE the table (tabs All, Live, In setup, At risk, Paused with counts; search
 * "Store, owner or domain", filter, sort) → the table: Store (name + status line), Owner, Plan, Health,
 * Sales · 30d, Orders, Billing, Last active; Lifecycle, Risk, Monthly fee and Renewal under Choose columns.
 *
 * Round 2 G18 / §6.2: a click anywhere on the row opens the store; the row ends in › only, and the ⋯ menu shows
 * on row hover (or focus). The in-place look (StoreRowDetail: sales, store numbers, apps, what to do) is the
 * ⋯ menu's "Quick look". Under 768px the rows are cards that open the store (§10).
 *
 * Today's tabs, saved views and filters are all kept (stores-tabs.util.ts): Trial and Unpaid are At risk slices,
 * Suspended is Paused, Deleted is behind the title ⋯, saved views are in the filter drawer. PRD-026 FR-3.4: the
 * lifecycle, profile and signal filters run on the server (`platformTenants(filter)`, `store-signals.util.ts`);
 * tab, search, filters, sort and page live in the URL.
 */

import { useApolloClient, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PLATFORM_STORE_PROFILE_OPTIONS } from "../../../graphql/store-profile";
import { PLATFORM_TENANT_SIGNALS } from "../../../graphql/tenants";
import { useUrlSearch } from "../../../hooks/use-url-search";
import { lifecycleLabel, lifecycleTone } from "../../../lib/platform-insights.util";
import { PLATFORM_PERMISSIONS } from "../../../lib/permissions";
import { planFilterOptions } from "../../../lib/plan-identity.util";
import { downloadCsv, rowsToCsv } from "../../../lib/report-csv";
import { healthBandEnum, joinParam, splitParam, type HealthBandKey } from "../../../lib/store-table.util";
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
import type { Client, Subscription } from "../../../types";
import type { PlatformList } from "../../../types/platform-api";
import { AppliedFilters, type AppliedFilterItem } from "../../common/AppliedFilters";
import {
  Avatar,
  Button,
  Chip,
  DataTable,
  EmptyState,
  FilterDrawer,
  RowChevron,
  RowMenu,
  TablePagination,
  TableToolbar,
  Tooltip,
  cx,
  formatCount,
  formatMoney,
  formatRelative,
  toast,
  toastError,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
  type RowMenuItem,
  type SegmentedItem,
  type SortOption,
} from "../../ui";
import {
  IconAdd,
  IconView,
  IconColumns,
  IconDelete,
  IconDownload,
  IconEdit,
  IconLink,
  IconLogin,
  IconPause,
  IconPayments,
  IconPlay,
  IconSend,
  IconStore,
  IconUndo,
} from "../../ui/icons";
import { useDeletedStoreCount } from "../RemovedStoresPanel";
import { StoreActionDialog, type StoreAction } from "../storeActions";
import { logInToStore, prepareStoreLogin } from "../storeLogin";
import { ColumnsDialog } from "./ColumnsDialog";
import { DeletedStoresTable } from "./DeletedStoresTable";
import { InPlaceDetail } from "./InPlaceDetail";
import { SendReminderDialog } from "./SendReminderDialog";
import { StoreHealthBar } from "./StoreHealthBar";
import { StoreRowDetail } from "./StoreRowDetail";
import {
  AGE_FILTER_OPTIONS,
  EMPTY_SERVER_PARAMS,
  LIFECYCLE_FILTER_OPTIONS,
  SERVER_PARAM_KEYS,
  STORE_EXPORT_COLUMNS,
  STORE_SIGNAL_OPTIONS,
  STORE_VIEWS,
  countServerFilters,
  profileFilterOptions,
  readServerParams,
  riskReasonsText,
  storeExportFilename,
  storeExportRow,
  storeViewEnum,
  toServerFilter,
  toStoreView,
  writeServerParams,
  type StoreServerFilter,
  type StoreServerParams,
  type StoreSignal,
} from "./store-signals.util";
import { fetchAllStoreSignals, useStoreSignals } from "./use-store-signals";
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
import {
  AT_RISK_REASON_OPTIONS,
  DELETED_TAB,
  STORES_TABS,
  atRiskReasonsOf,
  isInSetup,
  matchesStoresTab,
  readStoresTabUrl,
  storesTabEnum,
  type AtRiskReason,
  type StoresTab,
  type StoresTabUrl,
} from "./stores-tabs.util";

// ─── Columns ──────────────────────────────────────────────────────────────

const OPEN_KEY = "open";

/** Fixed widths 916px → Store keeps 200px at 1,116px (a 1440px screen); "narrow" columns go below that. */
const columns: DataTableColumn[] = [
  { key: "store", label: "Store", sortable: true, skeleton: "avatar", mobile: "primary" },
  { key: "owner", label: "Owner", width: 180, hideWhen: "narrow", sortable: true },
  { key: "plan", label: "Plan", width: 120, hideWhen: "narrow", sortable: true, skeleton: "badge" },
  { key: "health", label: "Health", width: 100, sortable: true },
  { key: "sales", label: "Sales · 30d", width: 120, sortable: true },
  { key: "orders", label: "Orders", width: 80, hideWhen: "narrow", sortable: true },
  { key: "payment", label: "Billing", width: 140, sortable: true, skeleton: "badge", mobile: "badge" },
  { key: "lastActive", label: "Last active", width: 100, hideWhen: "narrow", sortable: true },
  // Choose columns, off by default (§1A: Status and Lifecycle → the line under the name; Risk → At risk).
  { key: "lifecycle", label: "Lifecycle", width: 130, hideWhen: "narrow", skeleton: "badge" },
  { key: "risk", label: "Risk", width: 80, hideWhen: "narrow" },
  { key: "fee", label: "Monthly fee", width: 110, hideWhen: "narrow", sortable: true },
  { key: "renewalDate", label: "Renewal", width: 120, hideWhen: "narrow", sortable: true },
  // The row end (G18): ⋯ on hover, then › into the store.
  { key: OPEN_KEY, label: "Open the store", hideLabel: true, width: 96, mobile: "hide" },
];

const OPTIONAL_COLUMNS = columns.filter((column) => column.key !== "store" && column.key !== OPEN_KEY);
const DEFAULT_COLUMNS = ["owner", "plan", "health", "sales", "orders", "payment", "lastActive"];

const SORT_DEFAULT = "default";
const SORT_OPTIONS: SortOption[] = [
  { key: SORT_DEFAULT, label: "Needs action first" },
  { key: "store:asc", label: "Store name, A to Z" },
  { key: "health:asc", label: "Lowest health first" },
  { key: "sales:desc", label: "Highest sales first" },
  { key: "orders:desc", label: "Most orders first" },
  { key: "lastActive:desc", label: "Active most recently" },
  { key: "payment:asc", label: "Owing first" },
  { key: "renewalDate:asc", label: "Renewing soonest" },
];

const EMPTY_BY_TAB: Partial<Record<StoresTab, { title: string; description: string }>> = {
  [storesTabEnum.LIVE]: { title: "No live stores yet", description: "Stores show here once they go live." },
  [storesTabEnum.IN_SETUP]: { title: "No stores in setup", description: "New stores show here until they go live." },
  [storesTabEnum.AT_RISK]: {
    title: "Nothing at risk",
    description: "Trials, stores that owe money and stores with warning signs show here.",
  },
  [storesTabEnum.PAUSED]: {
    title: "No paused stores",
    description: "Suspended stores stay here until they're reactivated or deleted.",
  },
};

/** The server's warning signs (the old At risk saved view), read once for the At risk tab. */
const AT_RISK_SIGNALS: StoreServerFilter = { atRisk: true };

const PAYMENT_KINDS = new Set<string>(Object.values(paymentKindEnum));
const HEALTH_KEYS = new Set<string>(Object.values(healthBandEnum));
const PHONE_QUERY = "(max-width: 767px)";

/** Saved views in the filter drawer; At risk is a tab now. */
const VIEW_OPTIONS = STORE_VIEWS.filter((view) => view.key !== storeViewEnum.AT_RISK).map((view) => ({
  value: view.key,
  label: view.label,
}));

// ─── URL state ────────────────────────────────────────────────────────────

interface Row {
  client: Client;
  subscription?: Subscription;
  payment: PaymentBadge;
}

/** The extra row under an opened row; it holds StoreRowDetail. */
interface DetailRow {
  detailOf: Row;
}

type TableRow = Row | DetailRow;

const isDetailRow = (row: TableRow): row is DetailRow => "detailOf" in row;

/** The in-browser filters from the URL; older links (`?overdue=1`, `?tab=overdue`, `?tab=trials-week`) included. */
function readFilters(params: Record<string, string>, tabUrl: StoresTabUrl): StoreListFilters {
  const filters: StoreListFilters = {
    plans: splitParam(params.plan),
    statuses: tabUrl.unpaidStatus ? [] : splitParam(params.status),
    health: splitParam(params.health).filter((key) => HEALTH_KEYS.has(key)) as HealthBandKey[],
    payment: splitParam(params.payment).filter((key) => PAYMENT_KINDS.has(key)) as PaymentKind[],
    renews: params.renews === "7" || params.renews === "30" ? params.renews : "",
    joined: JOINED_OPTIONS.some((option) => option.value === params.joined) ? params.joined : "",
  };
  if (params.overdue === "1" || tabUrl.overdue) {
    filters.payment = Array.from(new Set([...filters.payment, paymentKindEnum.GRACE, paymentKindEnum.OVERDUE]));
  }
  if (tabUrl.renewsWithinWeek) filters.renews = "7";
  return filters;
}

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return phone;
}

/** "Live · no products yet", "In setup · joined Oct 2026", else the status and the domain. */
/**
 * The Owner cell: name and email, "Invited" with the email before the owner joins, "No owner yet" without either.
 * PRD-036 round 2 gaps: `ownerJoined` (invite accepted) decides when known; before the first snapshot that has it,
 * an owner with an email but no name still reads "Invited".
 */
function ownerCell(client: Pick<Client, "ownerName" | "ownerEmail" | "ownerJoined">): { name: string; email: string | null; invited: boolean } {
  const known = (value: string | undefined) => (value && value.trim() && value.trim() !== "—" ? value.trim() : null);
  const name = known(client.ownerName);
  const email = known(client.ownerEmail);
  if (email && client.ownerJoined === false) return { name: "Invited", email, invited: true };
  if (name) return { name, email, invited: false };
  if (email) return { name: "Invited", email, invited: true };
  return { name: "No owner yet", email: null, invited: false };
}

function storeLine(client: Client): string {
  const status = storeStatusBadge(client).label;
  if (isInSetup(client)) {
    const joined = new Date(client.joinedDate);
    const month = Number.isNaN(joined.getTime())
      ? null
      : new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(joined);
    return month ? `In setup · joined ${month}` : "In setup";
  }
  if (storeLifecycleKey(client) === storeLifecycleEnum.LIVE && client.hasUsage !== false && client.usage.products === 0) {
    return `${status} · no products yet`;
  }
  const where = client.domain || client.slug;
  return where ? `${status} · ${where}` : status;
}

// ─── Table ────────────────────────────────────────────────────────────────

export interface StoresTableProps {
  clients: Client[];
  isLoading?: boolean;
  /** The title row; the table hands it the ⋯ items (Export, Choose columns, Deleted stores). */
  renderHeader: (more: RowMenuItem[]) => ReactNode;
  /** Between the title row and the toolbar: the summary panel and the loading notices. */
  beforeTable?: ReactNode;
}

export function StoresTable({ clients, isLoading = false, renderHeader, beforeTable }: StoresTableProps) {
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { subscriptions, plans } = useClients();
  const { settings } = usePlatformSettings();
  const { can, user } = useAuth();
  // Client-side mirror of the backend guards; the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const canRemind = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canDelete = canManage && user?.role === "PLATFORM_OWNER";

  const url = useTableUrlState();
  const tabUrl = readStoresTabUrl(url.filters);
  const { tab, why, deleted } = tabUrl;
  const filters = readFilters(url.filters, tabUrl);
  const filtersKey = JSON.stringify(filters);
  const whyKey = why.join(",");
  const [searchInput, setSearchInput] = useUrlSearch(url.search, url.setSearch);
  // v4 (design v2 columns): Owner, Orders and Last active on; Lifecycle, Risk and Monthly fee under Choose columns.
  const [savedColumns, setSavedColumns] = usePersistentColumns("stores.v4", DEFAULT_COLUMNS);
  const apollo = useApolloClient();
  // `view=at-risk` is the At risk tab now (its Warning signs slice), not a saved view.
  const rawServer = readServerParams(url.filters);
  const server: StoreServerParams = tabUrl.atRiskView ? { ...rawServer, view: "" } : rawServer;
  const serverKey = JSON.stringify(server);
  const serverFilter = useMemo(() => toServerFilter(JSON.parse(serverKey) as StoreServerParams), [serverKey]);
  // Every store's signals (columns, option lists), the filter's matches, and the stores with warning signs.
  const allSignals = useStoreSignals(null);
  const matched = useStoreSignals(serverFilter, { skip: !serverFilter });
  const flagged = useStoreSignals(AT_RISK_SIGNALS);
  const profileOptionsQuery = useQuery<{ platformStoreProfileOptions: { categories: string[]; sources: string[] } }>(
    PLATFORM_STORE_PROFILE_OPTIONS,
  );
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ client: Client; action: StoreAction } | null>(null);
  const [reminding, setReminding] = useState<Client[]>([]);
  const deletedCount = useDeletedStoreCount(false);
  const now = useMemo(() => new Date(), []);

  const visibleColumns = useMemo(() => new Set(["store", ...savedColumns, OPEN_KEY]), [savedColumns]);
  const flaggedIds = flagged.matchingIds;
  const isFlagged = (id: string) => flaggedIds?.has(id) ?? false;

  // Every active plan (custom plans included, so a store on one can be found).
  const planOptions = useMemo(
    () => planFilterOptions(plans.filter((plan) => (plan.status ?? "ACTIVE") === "ACTIVE")),
    [plans],
  );
  const planLabel = useMemo(() => new Map(planOptions.map((option) => [option.key, option.label])), [planOptions]);

  const matchingIds = matched.matchingIds;
  const rows = useMemo<Row[]>(() => {
    const byClient = latestSubscriptionByClient(subscriptions);
    // A server filter shows only the stores the server matched
    const scoped = serverFilter ? (matchingIds ? clients.filter((client) => matchingIds.has(client.id)) : []) : clients;
    return scoped.map((client) => {
      const subscription = byClient.get(client.id);
      return { client, subscription, payment: paymentBadge(subscription, graceDaysFor(client, settings.gracePeriodDays)) };
    });
  }, [clients, matchingIds, serverFilter, settings.gracePeriodDays, subscriptions]);

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
    const counts: Partial<Record<StoresTab, number>> = {};
    STORES_TABS.forEach(({ value }) => {
      counts[value] = searched.filter((row) =>
        matchesStoresTab(value, row.client, row.subscription, flaggedIds?.has(row.client.id) ?? false, value === storesTabEnum.AT_RISK ? why : []),
      ).length;
    });
    return counts;
    // whyKey stands for `why`, rebuilt from the URL each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, flaggedIds, whyKey]);

  const sorted = useMemo(() => {
    const items = searched.filter((row) =>
      matchesStoresTab(tab, row.client, row.subscription, flaggedIds?.has(row.client.id) ?? false, why),
    );
    const sort = url.sort;
    if (!sort) return items.sort(compareNeedsAction);
    items.sort((a, b) => compareByColumn(a, b, sort.column));
    return sort.direction === "desc" ? items.reverse() : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, tab, whyKey, flaggedIds, url.sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / url.pageSize));
  const page = Math.min(url.page, pageCount);
  const pageRows = sorted.slice((page - 1) * url.pageSize, page * url.pageSize);
  // The opened row gets its detail row right under it (desktop only; phone rows open the store).
  const tableRows: TableRow[] = isPhone
    ? pageRows
    : pageRows.flatMap((row) => (row.client.id === openId ? [row, { detailOf: row }] : [row]));

  // ─── Changing the URL ───────────────────────────────────────────────────

  /** Older links are written back the new way (tab + why) on the next change. */
  const canonical: Record<string, string | undefined> = {
    tab: deleted ? DELETED_TAB : tab === storesTabEnum.ALL ? undefined : tab,
    why: joinParam(why),
    overdue: undefined,
    ...(tabUrl.atRiskView ? { view: undefined } : {}),
  };
  const filterParams = (next: StoreListFilters) => ({
    plan: joinParam(next.plans),
    status: joinParam(next.statuses),
    health: joinParam(next.health),
    payment: joinParam(next.payment),
    renews: next.renews || undefined,
    joined: next.joined || undefined,
  });
  // The derived filters (Unpaid's status, Overdue's payment, a week's renewals) are written out with the tab.
  const writeFilters = (next: StoreListFilters) => url.setParams({ ...canonical, ...filterParams(next) });
  const writeServer = (next: StoreServerParams) => url.setParams({ ...canonical, ...writeServerParams(next) });
  const setWhy = (next: AtRiskReason[]) => url.setParams({ ...canonical, ...filterParams(filters), why: joinParam(next) });
  const setTab = (next: string) => {
    setOpenId(null);
    url.setParams({
      ...canonical,
      ...(tabUrl.legacy ? filterParams(filters) : {}),
      tab: next === storesTabEnum.ALL ? undefined : next,
      why: undefined,
    });
  };
  const clearFilters = () => {
    setSearchInput("");
    url.setParams({
      ...canonical,
      q: undefined,
      why: undefined,
      plan: undefined,
      status: undefined,
      health: undefined,
      payment: undefined,
      renews: undefined,
      joined: undefined,
      ...Object.fromEntries(SERVER_PARAM_KEYS.map((key) => [key, undefined])),
    });
  };
  const sortValue = url.sort ? `${url.sort.column}:${url.sort.direction}` : SORT_DEFAULT;
  const setSortKey = (key: string) => {
    if (key === SORT_DEFAULT) return url.setSort(undefined);
    const [column, direction] = key.split(":");
    url.setSort({ column, direction: direction === "desc" ? "desc" : "asc" });
  };

  // ─── PRD-026: option lists and export ───────────────────────────────────

  const profileChoices = useMemo(() => {
    const fromProfiles = profileFilterOptions(allSignals.signals);
    return {
      ...fromProfiles,
      categories: profileOptionsQuery.data?.platformStoreProfileOptions.categories ?? [],
      sources: profileOptionsQuery.data?.platformStoreProfileOptions.sources ?? [],
    };
  }, [allSignals.signals, profileOptionsQuery.data]);
  const asOption = (value: string) => ({ value, label: value });

  // A server filter's matches arrive after the stores themselves
  const serverLoading = isLoading || (serverFilter !== null && matched.loading);

  /** Guide §6: the rows shown (same server filter, read 100 a page), as CSV. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const signals = serverFilter ? matched.byId : allSignals.byId;
      const csv = rowsToCsv(
        sorted.map((row) => storeExportRow(row.client, signals.get(row.client.id) ?? allSignals.byId.get(row.client.id))),
        STORE_EXPORT_COLUMNS.map((column) => ({ key: column.key, label: column.label })),
      );
      downloadCsv(storeExportFilename(), csv);
    } catch {
      toastError("Couldn't export the stores.");
    } finally {
      setExporting(false);
    }
  };

  // ─── Filter drawer ──────────────────────────────────────────────────────

  const groups = useMemo<FilterGroup[]>(
    () => [
      // The At risk slices (today's Trial and Unpaid tabs, and the At risk saved view).
      ...(tab === storesTabEnum.AT_RISK
        ? [{ key: "why", label: "At risk because", type: "options" as const, options: AT_RISK_REASON_OPTIONS }]
        : []),
      // Saved views (guide §6), the old "All stores ▾" button.
      { key: "view", label: "Saved view", type: "single", options: VIEW_OPTIONS },
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
      // PRD-026 guide §6: filtered on the server
      { key: "lifecycle", label: "Lifecycle", type: "options", options: LIFECYCLE_FILTER_OPTIONS },
      { key: "signal", label: "Signals", type: "options", options: STORE_SIGNAL_OPTIONS },
      ...(profileChoices.categories.length
        ? [{ key: "category", label: "Category", type: "checklist" as const, options: profileChoices.categories.map(asOption) }]
        : []),
      ...(profileChoices.sources.length
        ? [{ key: "source", label: "Source", type: "checklist" as const, options: profileChoices.sources.map(asOption) }]
        : []),
      ...(profileChoices.cities.length
        ? [{ key: "city", label: "City", type: "select" as const, options: profileChoices.cities.map(asOption) }]
        : []),
      ...(profileChoices.states.length
        ? [{ key: "state", label: "State", type: "select" as const, options: profileChoices.states.map(asOption) }]
        : []),
      ...(profileChoices.managers.length
        ? [{ key: "manager", label: "Account manager", type: "checklist" as const, options: profileChoices.managers }]
        : []),
      ...(profileChoices.tags.length
        ? [{ key: "tag", label: "Tags (all of)", type: "checklist" as const, options: profileChoices.tags.map(asOption) }]
        : []),
      { key: "age", label: "Age since go-live", type: "options", options: AGE_FILTER_OPTIONS },
    ],
    [planOptions, profileChoices, tab],
  );

  const drawerValue = useMemo<FilterValues>(
    () => ({
      why,
      view: server.view,
      lifecycle: server.lifecycle,
      signal: server.signal,
      category: server.category,
      source: server.source,
      city: server.city,
      state: server.state,
      manager: server.manager,
      tag: server.tag,
      age: server.age,
      plan: filters.plans,
      status: filters.statuses,
      health: filters.health,
      payment: filters.payment,
      renews: filters.renews,
      joined: filters.joined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey, serverKey, whyKey],
  );

  const listOf = (values: FilterValues, key: string) => (Array.isArray(values[key]) ? (values[key] as string[]) : []);
  const oneOf = (values: FilterValues, key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");

  /** The drawer's server-side groups, the saved view among them. */
  const serverFromDrawer = (values: FilterValues): StoreServerParams =>
    readServerParams(
      Object.fromEntries(
        Object.entries(
          writeServerParams({
            ...EMPTY_SERVER_PARAMS,
            view: toStoreView(oneOf(values, "view")),
            lifecycle: listOf(values, "lifecycle") as StoreServerParams["lifecycle"],
            signal: listOf(values, "signal") as StoreServerParams["signal"],
            category: listOf(values, "category"),
            source: listOf(values, "source"),
            manager: listOf(values, "manager"),
            tag: listOf(values, "tag"),
            age: listOf(values, "age") as StoreServerParams["age"],
            city: oneOf(values, "city"),
            state: oneOf(values, "state"),
          }),
        ).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
    );

  const fromDrawer = (values: FilterValues): StoreListFilters => ({
    plans: listOf(values, "plan"),
    statuses: listOf(values, "status"),
    health: listOf(values, "health") as HealthBandKey[],
    payment: listOf(values, "payment") as PaymentKind[],
    renews: oneOf(values, "renews"),
    joined: oneOf(values, "joined"),
  });

  const countResults = async (draft: FilterValues) => {
    const next = fromDrawer(draft);
    const nextWhy = listOf(draft, "why") as AtRiskReason[];
    const nextServer = toServerFilter(serverFromDrawer(draft));
    let ids: Set<string> | null = null;
    if (nextServer) {
      const result = await fetchAllStoreSignals(async (offset) => {
        const answer = await apollo.query<{ platformTenants: PlatformList<StoreSignal> }>({
          query: PLATFORM_TENANT_SIGNALS,
          variables: { filter: nextServer, limit: 100, offset },
        });
        return answer.data.platformTenants;
      });
      ids = new Set(result.items.map((item) => item.id));
    }
    const byClient = latestSubscriptionByClient(subscriptions);
    return clients
      .map((client) => {
        const subscription = byClient.get(client.id);
        return { client, subscription, payment: paymentBadge(subscription, graceDaysFor(client, settings.gracePeriodDays)) };
      })
      .filter((row) => !ids || ids.has(row.client.id))
      .filter(
        (row) =>
          matchesSearch(row.client, query) &&
          matchesListFilters(next, row.client, row.subscription, row.payment.kind, now) &&
          matchesStoresTab(tab, row.client, row.subscription, isFlagged(row.client.id), nextWhy),
      ).length;
  };

  const statusLabel = (value: string) => {
    const key = normaliseLifecycleKey(value);
    return key ? storeLifecycleLabel(key) : value;
  };
  const optionLabel = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const chips: AppliedFilterItem[] = [
    ...why.map((reason) => ({
      key: `why-${reason}`,
      label: `At risk: ${optionLabel(AT_RISK_REASON_OPTIONS, reason).toLowerCase()}`,
      onRemove: () => setWhy(why.filter((value) => value !== reason)),
    })),
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
    // PRD-026 guide §6: the server-side filters
    ...(server.view
      ? [{ key: "view", label: `View: ${STORE_VIEWS.find((view) => view.key === server.view)?.label ?? server.view}`, onRemove: () => writeServer({ ...server, view: "" }) }]
      : []),
    ...server.lifecycle.map((value) => ({
      key: `lifecycle-${value}`,
      label: `Lifecycle: ${lifecycleLabel(value)}`,
      onRemove: () => writeServer({ ...server, lifecycle: server.lifecycle.filter((v) => v !== value) }),
    })),
    ...server.signal.map((value) => ({
      key: `signal-${value}`,
      label: optionLabel(STORE_SIGNAL_OPTIONS, value),
      onRemove: () => writeServer({ ...server, signal: server.signal.filter((v) => v !== value) }),
    })),
    ...server.category.map((value) => ({
      key: `category-${value}`,
      label: `Category: ${value}`,
      onRemove: () => writeServer({ ...server, category: server.category.filter((v) => v !== value) }),
    })),
    ...server.source.map((value) => ({
      key: `source-${value}`,
      label: `Source: ${value}`,
      onRemove: () => writeServer({ ...server, source: server.source.filter((v) => v !== value) }),
    })),
    ...(server.city ? [{ key: "city", label: `City: ${server.city}`, onRemove: () => writeServer({ ...server, city: "" }) }] : []),
    ...(server.state ? [{ key: "state", label: `State: ${server.state}`, onRemove: () => writeServer({ ...server, state: "" }) }] : []),
    ...server.manager.map((value) => ({
      key: `manager-${value}`,
      label: `Account manager: ${optionLabel(profileChoices.managers, value)}`,
      onRemove: () => writeServer({ ...server, manager: server.manager.filter((v) => v !== value) }),
    })),
    ...server.tag.map((value) => ({
      key: `tag-${value}`,
      label: `Tag: ${value}`,
      onRemove: () => writeServer({ ...server, tag: server.tag.filter((v) => v !== value) }),
    })),
    ...server.age.map((value) => ({
      key: `age-${value}`,
      label: `Age: ${optionLabel(AGE_FILTER_OPTIONS, value)}`,
      onRemove: () => writeServer({ ...server, age: server.age.filter((v) => v !== value) }),
    })),
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
    const items: RowMenuItem[] = [
      // Round 2 G18: the caret is gone; the in-place look moved here.
      {
        key: "peek",
        label: openId === client.id ? "Close quick look" : "Quick look",
        icon: IconView,
        onSelect: () => toggleRow(client.id),
      },
    ];
    if (canImpersonate) {
      items.push({ key: "login", label: "Log in to store", icon: IconLogin, onSelect: () => void logInToStore(client) });
    }
    // In setup (the old Onboarding page): the setup checklist, provisioning and Go live are on the store page.
    if (isInSetup(client)) {
      items.push({
        key: "setup",
        label: "Set up and go live",
        icon: IconStore,
        onSelect: () => navigate(`/stores/${client.id}/overview#setup`),
      });
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
        onSelect: () => navigate(`/stores/${client.id}/settings?edit=1`),
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

  const toggleRow = (id: string) => setOpenId((current) => (current === id ? null : id));
  const measured = (client: Client) => client.hasUsage !== false;
  const dash = <span className="text-fg-subtle">—</span>;

  /** Words for the opened row's "what to do" when there is no insight: why it's at risk. */
  const riskTextOf = (row: Row): string | undefined => {
    const reasons = atRiskReasonsOf(row.client, row.subscription, isFlagged(row.client.id));
    if (!reasons.length) return undefined;
    const words = reasons
      .filter((reason) => reason !== "signals")
      .map((reason) => optionLabel(AT_RISK_REASON_OPTIONS, reason));
    const signs = riskReasonsText(allSignals.byId.get(row.client.id)?.riskReasons);
    if (reasons.includes("signals")) words.push(signs ? `Warning signs: ${signs.toLowerCase()}` : "Warning signs");
    return `${words.join(" · ")}.`;
  };

  const renderCell = (item: TableRow, key: string) => {
    if (isDetailRow(item)) {
      if (key !== "store") return null;
      const { client, subscription } = item.detailOf;
      return (
        <InPlaceDetail label={`${client.storeName} at a glance`}>
          <StoreRowDetail client={client} subscription={subscription} riskText={riskTextOf(item.detailOf)} />
        </InPlaceDetail>
      );
    }
    const { client, payment, subscription } = item;
    switch (key) {
      case "store":
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={client.storeName} size="md" className="shrink-0" />
            <div className="min-w-0">
              {/* The name goes into the store; the rest of the row opens in place. Keep the press off the row. */}
              <Link
                to={`/stores/${client.id}/overview`}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className="block truncate text-body font-medium text-fg hover:underline"
                title={client.storeName}
              >
                {client.storeName}
              </Link>
              <p className="truncate text-label text-fg-muted">{storeLine(client)}</p>
            </div>
          </div>
        );
      case "owner": {
        // Round 2 §6.2: never "—" over "—"; "Invited" until the owner accepts (owner.joined, PRD-036 round 2 gaps).
        const owner = ownerCell(client);
        return (
          <div className="min-w-0">
            <p className={cx("truncate text-body", owner.invited || !owner.email ? "text-fg-muted" : "text-fg")}>{owner.name}</p>
            {owner.email ? <p className="truncate text-label text-fg-muted">{owner.email}</p> : null}
          </div>
        );
      }
      case "plan":
        return <Chip tone="neutral">{planShortName(client)}</Chip>;
      case "lifecycle": {
        const status = allSignals.byId.get(client.id)?.lifecycleStatus;
        return status ? <Chip tone={lifecycleTone(status)}>{lifecycleLabel(status)}</Chip> : dash;
      }
      case "risk": {
        const signal = allSignals.byId.get(client.id);
        if (!signal || signal.riskScore == null) return dash;
        if (signal.riskScore === 0) return <span className="num text-fg-muted">0</span>;
        return (
          <Tooltip content={riskReasonsText(signal.riskReasons) || "Warning signs"} placement="top-start">
            <span className="num font-medium text-tone-warning" aria-label={`Risk ${signal.riskScore}: ${riskReasonsText(signal.riskReasons)}`}>
              {signal.riskScore}
            </span>
          </Tooltip>
        );
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
        return client.revenue > 0 ? (
          <span className="num">{formatMoney(client.revenue, { whole: true })}</span>
        ) : (
          <span className="text-fg-muted">No sales yet</span>
        );
      case "orders":
        return measured(client) ? <span className="num">{formatCount(client.orders30d)}</span> : dash;
      case "lastActive":
        // No activity snapshot falls back to the epoch in the adapter: show nothing then.
        return client.lastActive && !client.lastActive.startsWith("1970") ? (
          <span className="num">{formatRelative(client.lastActive, now)}</span>
        ) : (
          dash
        );
      case "fee":
        return client.mrr > 0 ? (
          <span className="num">{formatMoney(client.mrr, { whole: true })}</span>
        ) : (
          <span className="text-fg-muted">No fee</span>
        );
      case "renewalDate":
        return subscription?.renewalDate ? <span className="num">{formatDate(subscription.renewalDate)}</span> : dash;
      case OPEN_KEY: {
        const open = openId === client.id;
        return (
          <div className="flex items-center justify-end gap-1">
            {/* G18: ⋯ only on row hover or keyboard focus (always on touch screens and while its look is open). */}
            <span
              className={cx(
                "transition-opacity duration-fast",
                !open && "opacity-0 focus-within:opacity-100 [tr:hover_&]:opacity-100 [@media(hover:none)]:opacity-100",
              )}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <RowMenu
                items={rowActions(item)}
                label={`Actions for ${client.storeName}`}
                onOpenChange={(open) => {
                  if (open && canImpersonate) prepareStoreLogin(client);
                }}
              />
            </span>
            {/* G18: › at the row end; the whole row opens the store too. */}
            <Link
              to={`/stores/${client.id}/overview`}
              aria-label={`Go to ${client.storeName}`}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="rounded-full outline-none focus-visible:shadow-focus-strong"
            >
              <RowChevron />
            </Link>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Phone row (§10): store name + billing badge; "In setup · joined Oct 2026 · Plus · ₹18,22,511".
  const mobileRow = (item: TableRow) => {
    if (isDetailRow(item)) return null;
    const line2 = [storeLine(item.client), planShortName(item.client), item.client.revenue > 0 ? formatMoney(item.client.revenue, { whole: true }) : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 truncate text-body font-medium text-fg">{item.client.storeName}</span>
          <Chip tone={item.payment.tone}>{item.payment.label}</Chip>
        </div>
        <p className="mt-1 truncate text-label text-fg-muted num">{line2}</p>
      </>
    );
  };

  // ─── Title ⋯, toolbar, empty states ─────────────────────────────────────

  const more: RowMenuItem[] = deleted
    ? [{ key: "all", label: "Back to all stores", icon: IconUndo, onSelect: () => setTab(storesTabEnum.ALL) }]
    : [
        {
          key: "export",
          label: "Export these stores (CSV)",
          icon: IconDownload,
          disabled: exporting || serverLoading,
          onSelect: () => void exportCsv(),
        },
        { key: "columns", label: "Choose columns", icon: IconColumns, onSelect: () => setColumnsOpen(true) },
        {
          key: "deleted",
          label: "Deleted stores",
          icon: IconDelete,
          description: deletedCount ? `${formatCount(deletedCount)} restorable or purged` : "Restore or see purged stores",
          onSelect: () => setTab(DELETED_TAB),
        },
      ];

  const tabItems: SegmentedItem<string>[] = [
    ...STORES_TABS.map((item) => ({ value: item.value, label: item.label, count: tabCounts[item.value] ?? 0 })),
    // Deleted shows as a tab only while its list is open (from the ⋯ menu).
    ...(deleted ? [{ value: DELETED_TAB, label: "Deleted", count: deletedCount ?? null }] : []),
  ];

  if (deleted) {
    return (
      <>
        {renderHeader(more)}
        {beforeTable}
        <DeletedStoresTable
          tabs={tabItems}
          tab={DELETED_TAB}
          onTabChange={setTab}
          search={searchInput}
          onSearchChange={setSearchInput}
          query={url.search}
        />
      </>
    );
  }

  const activeFilters = countFilters(filters) + countServerFilters(server) + why.length + (server.view ? 1 : 0);
  const hasFilters = query !== "" || activeFilters > 0 || !!server.view;
  const tabEmpty = EMPTY_BY_TAB[tab];
  const emptyContent = hasFilters ? (
    <EmptyState kind="no-results" title="No stores match these filters" onClearFilters={clearFilters} />
  ) : tab === storesTabEnum.ALL ? (
    <EmptyState
      icon={IconStore}
      title="No stores yet"
      description="Create your first store to start billing it."
      action={
        canManage ? (
          <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
            Create store
          </Button>
        ) : undefined
      }
    />
  ) : (
    <EmptyState icon={IconStore} title={tabEmpty?.title} description={tabEmpty?.description} />
  );

  const toolbar = (
    <TableToolbar<string>
      tabs={tabItems}
      tab={tab}
      onTabChange={setTab}
      tabsLabel="Store status"
      search={searchInput}
      onSearchChange={setSearchInput}
      searchPlaceholder="Store, owner or domain"
      onOpenFilters={() => setFiltersOpen(true)}
      filterCount={activeFilters}
      sort={{ options: SORT_OPTIONS, value: sortValue, onChange: setSortKey, label: "Sort stores" }}
    />
  );

  return (
    <>
      {renderHeader(more)}
      {beforeTable}

      {/* The @container lets a row opened in place span the card's full width (InPlaceDetail). */}
      <div className="@container">
        <DataTable<TableRow>
          aria-label="Stores"
          columns={columns}
          visibleColumns={visibleColumns}
          rows={tableRows}
          getRowKey={(item) => (isDetailRow(item) ? `${item.detailOf.client.id}:detail` : item.client.id)}
          renderCell={renderCell}
          isLoading={serverLoading}
          // Round 3 C4: the tabs filter the loaded stores here, so a switch is instant; the rows cross-fade.
          tabKey={tab}
          rowHeight="tall"
          stickyFirstColumn
          toolbar={toolbar}
          chips={
            <>
              <AppliedFilters items={chips} onClearAll={clearFilters} />
              {serverFilter && matched.error ? (
                <p role="alert" className="px-4 py-2 text-label text-tone-danger-text">
                  Couldn&apos;t apply these filters on the server.{" "}
                  <button type="button" className="underline" onClick={matched.refetch}>
                    Try again
                  </button>
                </p>
              ) : null}
              {tab === storesTabEnum.AT_RISK && flagged.error ? (
                <p role="alert" className="px-4 py-2 text-label text-tone-danger-text">
                  Couldn&apos;t load the stores with warning signs.{" "}
                  <button type="button" className="underline" onClick={flagged.refetch}>
                    Try again
                  </button>
                </p>
              ) : null}
              {serverFilter && !matched.loading && !matched.error && matched.totalCount != null && matched.totalCount > rows.length ? (
                <p role="status" className="px-4 py-2 text-label text-fg-muted">
                  {matched.totalCount - rows.length} matching {matched.totalCount - rows.length === 1 ? "store isn't" : "stores aren't"} in the loaded list (deleted, or still loading).
                </p>
              ) : null}
            </>
          }
          footer={
            !serverLoading && sorted.length > 0 ? (
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
          rowChevron={false}
          // Round 2 G18: the whole row opens the store (desktop and phone).
          onRowAction={(item) => {
            if (isDetailRow(item)) return;
            navigate(`/stores/${item.client.id}/overview`);
          }}
          rowActions={isPhone ? (item) => (isDetailRow(item) ? [] : rowActions(item)) : undefined}
          rowActionsLabel={(item) => `Actions for ${isDetailRow(item) ? item.detailOf.client.storeName : item.client.storeName}`}
          mobileRow={mobileRow}
          emptyContent={emptyContent}
        />
      </div>

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={groups}
        value={drawerValue}
        onApply={(values) => {
          const next = fromDrawer(values);
          const nextServer = serverFromDrawer(values);
          url.setParams({
            ...canonical,
            ...filterParams(next),
            ...writeServerParams(nextServer),
            why: tab === storesTabEnum.AT_RISK ? joinParam(listOf(values, "why")) : undefined,
          });
        }}
        countResults={countResults}
      />

      <ColumnsDialog
        isOpen={columnsOpen}
        columns={OPTIONAL_COLUMNS}
        selected={savedColumns}
        onSave={setSavedColumns}
        onClose={() => setColumnsOpen(false)}
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

