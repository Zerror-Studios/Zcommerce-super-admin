/**
 * Subscriptions (04 S-04): one full-width table of every store's subscription, with no side panel. Collections,
 * Invoices, Transactions and Payment reminders merged in here (their old routes redirect, see App.tsx).
 *
 * - Tabs (Active · Due & overdue · Trial · Cancelled), Last payment and Next due always show today.
 * - The period ("This month", `?from=&to=`) sets the header line's "paid" count and the Invoices and Payments
 *   exports. The Payment badge is the server's judgement for today (the live behaviour; 06 Q30 is open).
 * - A row opens the store's Billing & plan (`/stores/:id/billing?from=subscriptions`); Send reminder opens S-04c.
 * - Search runs on the server (store, owner name and email); the other filters run on the loaded rows.
 */

import { useApolloClient, useQuery } from "@apollo/client";
import { endOfDay, format, isValid, parseISO, startOfDay, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppliedFilters, type AppliedFilterItem } from "../components/common/AppliedFilters";
import { DateRangeComparison, type DateRangeValue } from "../components/common/DateRangeComparison";
import { PageHeader } from "../components/common/PageHeader";
import {
  CYCLE_OPTIONS,
  HEALTH_OPTIONS,
  ISSUE_OPTIONS,
  PAYMENT_OPTIONS,
  RENEWS_OPTIONS,
  SUBSCRIPTION_TABS,
  buildSubscriptionRows,
  compareSubscriptionRows,
  isOwed,
  isSubscriptionTab,
  matchesFilters,
  matchesTab,
  paymentDetail,
  shortDate,
  subscriptionTabEnum,
  type SubscriptionFilters,
  type SubscriptionRow,
  type SubscriptionTab,
} from "../components/billing/subscription-rows";
import { SubscriptionDialogs, type SubscriptionDialog } from "../components/clients/SubscriptionActions";
import { SendReminderDialog } from "../components/clients/stores-list/SendReminderDialog";
import { logInToStore } from "../components/clients/storeLogin";
import { PLATFORM_PAYMENTS, PLATFORM_STALE_PENDING_PAYMENTS } from "../graphql/billing";
import { useCollections } from "../hooks/use-platform-reports";
import { useUrlSearch } from "../hooks/use-url-search";
import { getPlanLabel, PLAN_NAMES } from "../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { downloadCsv, rowsToCsv } from "../lib/report-csv";
import { latestSubscriptionByClient } from "../lib/subscription-lookup.util";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformSettings } from "../providers/SettingsProvider";
import type { Client } from "../types";
import type { PlatformList, PlatformPayment, StalePendingPaymentList } from "../types/platform-api";
import { toasts } from "../copy";
import {
  Button,
  Chip,
  DataTable,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterDrawer,
  IconButton,
  SearchInput,
  SegmentedSwitch,
  SelectionBar,
  TablePagination,
  countActiveFilters,
  formatCount,
  formatMoney,
  toastError,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
  type RowMenuItem,
} from "../components/ui";
import {
  IconCaret,
  IconColumns,
  IconDownload,
  IconExchange,
  IconLogin,
  IconPayments,
  IconRevenue,
  IconSend,
  IconXCircle,
} from "../components/ui/icons";

// ─── Columns ──────────────────────────────────────────────────────────────

/**
 * Fixed 656 (700 with checkboxes) → Store and plan 304px at 960px. "tablet: hide" columns go under 856px; narrow:
 * Store and plan | Payment | Quick action | ⋯.
 */
const columns: DataTableColumn[] = [
  { key: "store", label: "Store and plan", mobile: "primary" },
  { key: "payment", label: "Payment", width: 200, skeleton: "badge", mobile: "badge" },
  { key: "lastPayment", label: "Last payment", width: 130, hideWhen: "narrow", mobile: "hide" },
  { key: "nextDue", label: "Next due", width: 110, hideWhen: "narrow" },
  // Optional (Columns menu), off by default.
  { key: "health", label: "Health", width: 110, hideWhen: "narrow", skeleton: "badge", mobile: "hide" },
  { key: "ownerEmail", label: "Owner email", width: 180, hideWhen: "narrow", mobile: "hide" },
  { key: "action", label: "Quick action", width: 160, mobile: "hide" },
];

const OPTIONAL_COLUMNS = [
  { key: "health", label: "Health" },
  { key: "ownerEmail", label: "Owner email" },
];
const ALWAYS_COLUMNS = ["store", "payment", "lastPayment", "nextDue", "action"];

const HEALTH_BADGE = {
  healthy: { label: "Healthy", tone: "success" },
  at_risk: { label: "At risk", tone: "warning" },
  unhealthy: { label: "Critical", tone: "danger" },
} as const;

const EMPTY_BY_TAB: Record<SubscriptionTab, { title: string; description: string }> = {
  active: { title: "No active subscriptions", description: "Stores on a paid plan show here." },
  due: { title: "Everyone's paid", description: "No store has a payment due or overdue." },
  trial: { title: "No stores in trial", description: "Stores on a free trial show here." },
  cancelled: { title: "No cancelled subscriptions", description: "Cancelled and ended subscriptions show here." },
};

/** URL params that aren't drawer filters. */
const NOT_FILTERS = ["tab", "from", "to"];

const money = (amount: number) => formatMoney(amount, { whole: true });
const day = (date: Date) => format(date, "yyyy-MM-dd");
const split = (value: string | undefined) => (value ? value.split(",").filter(Boolean) : []);

function readDay(value: string | undefined): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

const PAYMENT_EXPORT_LIMIT = 200;
const PAYMENT_EXPORT_PAGES = 25;

export function Subscriptions() {
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const { can } = useAuth();
  const canManageBilling = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const { clients, subscriptions, loading: clientsLoading } = useClients();
  const { settings } = usePlatformSettings();

  const url = useTableUrlState({ ignore: NOT_FILTERS });
  const [searchInput, setSearchInput] = useUrlSearch(url.search, url.setSearch);
  const setParamsRaw = url.setParams;

  // Tab and period live in the URL too (ignored as filters).
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: SubscriptionTab = isSubscriptionTab(tabParam) ? tabParam : subscriptionTabEnum.ACTIVE;
  const today = useMemo(() => new Date(), []);
  const fromDay = readDay(searchParams.get("from") ?? undefined);
  const toDay = readDay(searchParams.get("to") ?? undefined);
  const range: DateRangeValue = {
    startDate: fromDay ? startOfDay(fromDay) : startOfMonth(today),
    endDate: toDay ? endOfDay(toDay) : endOfDay(today),
  };
  const isDefaultPeriod = !fromDay && !toDay;

  const setTab = (next: SubscriptionTab) => {
    setSelected(new Set());
    setParamsRaw({ tab: next === subscriptionTabEnum.ACTIVE ? undefined : next });
  };
  const setRange = (next: DateRangeValue) =>
    setParamsRaw({ from: day(next.startDate), to: day(next.endDate) });

  const filters: SubscriptionFilters = {
    payment: split(url.filters.payment).filter((value): value is SubscriptionFilters["payment"][number] =>
      PAYMENT_OPTIONS.some((option) => option.value === value),
    ),
    renews: RENEWS_OPTIONS.some((option) => option.value === url.filters.renews) ? (url.filters.renews ?? "") : "",
    plans: split(url.filters.plan),
    cycle: split(url.filters.cycle),
    health: split(url.filters.health),
    issue: ISSUE_OPTIONS.some((option) => option.value === url.filters.issue) ? (url.filters.issue ?? "") : "",
  };

  // PRD-024 FR-2.3: the server's rows for the period; search on the server.
  const api = useCollections({ startDate: range.startDate, endDate: range.endDate, drill: "all", search: url.search });

  // Payment issues (S-04 change 7): which stores have a flagged or a stuck payment.
  const flagged = useQuery<{ platformPayments: PlatformList<PlatformPayment> }>(PLATFORM_PAYMENTS, {
    variables: { filter: { flagged: true }, limit: PAYMENT_EXPORT_LIMIT, offset: 0 },
    skip: filters.issue !== "flagged",
    fetchPolicy: "cache-and-network",
  });
  const stuck = useQuery<{ platformStalePendingPayments: StalePendingPaymentList }>(PLATFORM_STALE_PENDING_PAYMENTS, {
    variables: { tenantId: null, limit: PAYMENT_EXPORT_LIMIT },
    skip: filters.issue !== "stuck",
    fetchPolicy: "cache-and-network",
  });
  const issueStores = useMemo(() => {
    if (filters.issue === "flagged") {
      const items = flagged.data?.platformPayments.items;
      return items ? new Set(items.map((payment) => payment.tenantId)) : null;
    }
    if (filters.issue === "stuck") {
      const items = stuck.data?.platformStalePendingPayments.items;
      return items ? new Set(items.map((payment) => payment.tenantId)) : null;
    }
    return null;
  }, [filters.issue, flagged.data, stuck.data]);

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const subscriptionByClient = useMemo(() => latestSubscriptionByClient(subscriptions), [subscriptions]);
  const allRows = useMemo(
    () =>
      buildSubscriptionRows(api.data?.shopRows ?? [], clientById, subscriptionByClient, settings.gracePeriodDays).sort(
        compareSubscriptionRows,
      ),
    [api.data, clientById, subscriptionByClient, settings.gracePeriodDays],
  );

  // Cheap over the loaded rows; `filters` is rebuilt from the URL on every render.
  const filteredRows = allRows.filter((row) => matchesFilters(row, filters, issueStores, today));
  const tabCounts = useMemo(() => {
    const counts: Record<SubscriptionTab, number> = { active: 0, due: 0, trial: 0, cancelled: 0 };
    for (const row of filteredRows) {
      for (const item of SUBSCRIPTION_TABS) if (matchesTab(row, item.value)) counts[item.value] += 1;
    }
    return counts;
  }, [filteredRows]);
  const rows = useMemo(() => filteredRows.filter((row) => matchesTab(row, tab)), [filteredRows, tab]);

  const pageCount = Math.max(1, Math.ceil(rows.length / url.pageSize));
  const page = Math.min(url.page, pageCount);
  const pageRows = rows.slice((page - 1) * url.pageSize, page * url.pageSize);

  // Header (whatever the filters): stores with a subscription, and the period's line.
  const summary = useMemo(() => {
    const start = range.startDate.getTime();
    const end = range.endDate.getTime();
    let paid = 0;
    let due = 0;
    let overdue = 0;
    let toCollect = 0;
    for (const row of allRows) {
      const last = row.report.lastPaymentDate ? Date.parse(row.report.lastPaymentDate) : NaN;
      if (last >= start && last <= end) paid += 1;
      if (row.payment.kind === "due") due += 1;
      if (row.payment.kind === "grace" || row.payment.kind === "overdue") overdue += 1;
      if (isOwed(row.payment.kind)) toCollect += row.owed;
    }
    return { paid, due, overdue, toCollect };
  }, [allRows, range.startDate, range.endDate]);

  // ─── Selection, dialogs ──────────────────────────────────────────────────

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reminding, setReminding] = useState<Client[]>([]);
  const [dialog, setDialog] = useState<{ row: SubscriptionRow; kind: SubscriptionDialog } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedColumns, setSavedColumns] = usePersistentColumns("subscriptions", []);
  const visibleColumns = useMemo(
    () => new Set([...ALWAYS_COLUMNS, ...[...savedColumns].filter((key) => OPTIONAL_COLUMNS.some((c) => c.key === key))]),
    [savedColumns],
  );

  const remind = (targets: SubscriptionRow[]) => {
    const stores = targets.map((row) => row.client).filter((client): client is Client => !!client);
    if (stores.length) setReminding(stores);
  };
  const billingHref = (row: SubscriptionRow) => `/stores/${row.id}/billing?from=subscriptions`;

  const rowActions = (row: SubscriptionRow): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      { key: "view", label: "View subscription", icon: IconPayments, onSelect: () => navigate(billingHref(row)) },
    ];
    const status = row.report.subscriptionStatus;
    if (canManageBilling && row.client && isOwed(row.payment.kind)) {
      items.push({ key: "remind", label: "Send reminder", icon: IconSend, onSelect: () => remind([row]) });
    }
    if (canManageBilling && row.client) {
      if (status === "ACTIVE" || status === "TRIAL" || status === "PAST_DUE") {
        items.push({ key: "payment", label: "Record payment", icon: IconRevenue, onSelect: () => setDialog({ row, kind: "payment" }) });
      }
      if (status !== "CANCELLED") {
        items.push({ key: "plan", label: "Change plan", icon: IconExchange, onSelect: () => setDialog({ row, kind: "plan" }) });
      }
    }
    if (canImpersonate && row.client) {
      const client = row.client;
      items.push({ key: "login", label: "Log in to store", icon: IconLogin, onSelect: () => void logInToStore(client) });
    }
    if (canManageBilling && row.client && status !== "CANCELLED" && status !== "SUSPENDED") {
      items.push({
        key: "cancel",
        label: "Cancel subscription",
        icon: IconXCircle,
        destructive: true,
        onSelect: () => setDialog({ row, kind: "cancel" }),
      });
    }
    return items;
  };

  // ─── Export ──────────────────────────────────────────────────────────────

  const period = `${day(range.startDate)}-to-${day(range.endDate)}`;
  const runExport = async (kind: string) => {
    if (kind === "subscriptions") {
      const csv = rowsToCsv(
        rows.map((row) => ({
          store: row.report.storeName,
          ownerEmail: row.report.ownerEmail,
          plan: getPlanLabel(row.report.plan),
          fee: row.report.mrr,
          payment: row.payment.label,
          owed: row.owed,
          daysOverdue: row.report.daysOverdue,
          lastPayment: row.report.lastPaymentDate ? day(parseISO(row.report.lastPaymentDate)) : "",
          nextDue: row.report.nextDueDate ? day(parseISO(row.report.nextDueDate)) : "",
          health: HEALTH_BADGE[row.report.health].label,
        })),
        [
          { key: "store", label: "Store" },
          { key: "ownerEmail", label: "Owner email" },
          { key: "plan", label: "Plan" },
          { key: "fee", label: "Monthly fee" },
          { key: "payment", label: "Payment" },
          { key: "owed", label: "Amount due" },
          { key: "daysOverdue", label: "Days overdue" },
          { key: "lastPayment", label: "Last payment" },
          { key: "nextDue", label: "Next due" },
          { key: "health", label: "Health" },
        ],
      );
      downloadCsv(`subscriptions-${period}.csv`, csv);
      return;
    }
    if (kind === "invoices") {
      // Invoices due in the period, plus failed and refunded payments in it (the live Collections list).
      const csv = rowsToCsv(
        (api.data?.paymentRows ?? []).map((row) => ({
          ...row,
          plan: getPlanLabel(row.plan),
          dueDate: row.dueDate ? day(parseISO(row.dueDate)) : "",
          paidDate: row.paidDate ? day(parseISO(row.paidDate)) : "",
        })),
        [
          { key: "transactionId", label: "Invoice" },
          { key: "shopName", label: "Store" },
          { key: "plan", label: "Plan" },
          { key: "amount", label: "Amount" },
          { key: "currency", label: "Currency" },
          { key: "status", label: "Status" },
          { key: "dueDate", label: "Due" },
          { key: "paidDate", label: "Paid" },
          { key: "paymentMethod", label: "Method" },
        ],
      );
      downloadCsv(`invoices-${period}.csv`, csv);
      return;
    }
    // Payments made in the period, read page by page.
    setExporting(true);
    try {
      const items: PlatformPayment[] = [];
      for (let index = 0; index < PAYMENT_EXPORT_PAGES; index += 1) {
        const { data } = await apollo.query<{ platformPayments: PlatformList<PlatformPayment> }>({
          query: PLATFORM_PAYMENTS,
          variables: {
            filter: { from: range.startDate.toISOString(), to: range.endDate.toISOString() },
            limit: PAYMENT_EXPORT_LIMIT,
            offset: index * PAYMENT_EXPORT_LIMIT,
          },
          fetchPolicy: "network-only",
        });
        items.push(...data.platformPayments.items);
        if (data.platformPayments.items.length < PAYMENT_EXPORT_LIMIT || items.length >= data.platformPayments.totalCount) break;
      }
      const csv = rowsToCsv(
        items.map((payment) => ({
          ...payment,
          createdAt: payment.createdAt ? format(parseISO(payment.createdAt), "yyyy-MM-dd HH:mm") : "",
          planName: payment.planName ? getPlanLabel(payment.planName) : "",
        })),
        [
          { key: "createdAt", label: "Date" },
          { key: "tenantName", label: "Store" },
          { key: "planName", label: "Plan" },
          { key: "amount", label: "Amount" },
          { key: "currency", label: "Currency" },
          { key: "status", label: "Status" },
          { key: "type", label: "Type" },
          { key: "provider", label: "Provider" },
          { key: "transactionId", label: "Transaction ID" },
        ],
      );
      downloadCsv(`payments-${period}.csv`, csv);
    } catch {
      toastError(toasts.genericError);
    } finally {
      setExporting(false);
    }
  };

  // ─── Filters ─────────────────────────────────────────────────────────────

  const planOptions = PLAN_NAMES.map((name) => ({ value: name, label: getPlanLabel(name) }));
  const groups: FilterGroup[] = [
    { key: "payment", label: "Payment", type: "options", options: PAYMENT_OPTIONS },
    { key: "renews", label: "Renews", type: "single", options: RENEWS_OPTIONS },
    { key: "plan", label: "Plan", type: "options", options: planOptions },
    { key: "cycle", label: "Billing cycle", type: "options", options: CYCLE_OPTIONS },
    { key: "health", label: "Health", type: "options", options: HEALTH_OPTIONS },
    { key: "issue", label: "Payment issues", type: "single", options: ISSUE_OPTIONS },
  ];
  const drawerValue: FilterValues = {
    payment: filters.payment,
    renews: filters.renews,
    plan: filters.plans,
    cycle: filters.cycle,
    health: filters.health,
    issue: filters.issue,
  };
  const toParam = (value: FilterValues[string]) =>
    Array.isArray(value) ? value.join(",") || undefined : typeof value === "string" ? value || undefined : undefined;
  const applyFilters = (values: FilterValues) => {
    setSelected(new Set());
    url.setParams(Object.fromEntries(groups.map((group) => [group.key, toParam(values[group.key])])));
  };
  const clearFilters = () => {
    setSearchInput("");
    url.setParams({ ...Object.fromEntries(groups.map((group) => [group.key, undefined])), q: undefined });
  };
  const countResults = (draft: FilterValues) => {
    const next: SubscriptionFilters = {
      payment: (Array.isArray(draft.payment) ? draft.payment : []) as SubscriptionFilters["payment"],
      renews: typeof draft.renews === "string" ? draft.renews : "",
      plans: Array.isArray(draft.plan) ? draft.plan : [],
      cycle: Array.isArray(draft.cycle) ? draft.cycle : [],
      health: Array.isArray(draft.health) ? draft.health : [],
      // The issue lists load once applied; count without them.
      issue: "",
    };
    return allRows.filter((row) => matchesTab(row, tab) && matchesFilters(row, next, null, today)).length;
  };

  const label = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const removeFrom = (key: string, list: string[], value: string) =>
    url.setFilter(key, list.filter((item) => item !== value).join(","));
  const chips: AppliedFilterItem[] = [
    ...filters.payment.map((value) => ({
      key: `payment-${value}`,
      label: `Payment: ${label(PAYMENT_OPTIONS, value)}`,
      onRemove: () => removeFrom("payment", filters.payment, value),
    })),
    ...(filters.renews
      ? [{ key: "renews", label: `Renews: ${label(RENEWS_OPTIONS, filters.renews).toLowerCase()}`, onRemove: () => url.setFilter("renews") }]
      : []),
    ...filters.plans.map((value) => ({
      key: `plan-${value}`,
      label: `Plan: ${label(planOptions, value)}`,
      onRemove: () => removeFrom("plan", filters.plans, value),
    })),
    ...filters.cycle.map((value) => ({
      key: `cycle-${value}`,
      label: `Billing: ${label(CYCLE_OPTIONS, value).toLowerCase()}`,
      onRemove: () => removeFrom("cycle", filters.cycle, value),
    })),
    ...filters.health.map((value) => ({
      key: `health-${value}`,
      label: `Health: ${label(HEALTH_OPTIONS, value)}`,
      onRemove: () => removeFrom("health", filters.health, value),
    })),
    ...(filters.issue
      ? [{ key: "issue", label: label(ISSUE_OPTIONS, filters.issue), onRemove: () => url.setFilter("issue") }]
      : []),
  ];

  // ─── Cells ───────────────────────────────────────────────────────────────

  const planLine = (row: SubscriptionRow) => {
    const plan = row.client?.planRef?.displayName || getPlanLabel(row.report.plan);
    if (row.report.mrr <= 0) return `${plan} · No fee`;
    const yearly = row.subscription?.billingCycle === "YEARLY";
    const fee = yearly ? `${money(row.report.mrr * 12)} / year` : `${money(row.report.mrr)} / month`;
    return `${plan} · ${fee}`;
  };

  const renderCell = (row: SubscriptionRow, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{row.report.storeName}</p>
            <p className="truncate text-label text-fg-muted num">{planLine(row)}</p>
          </div>
        );
      case "payment": {
        const detail = paymentDetail(row, money);
        return (
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <Chip tone={row.payment.tone}>{row.payment.label}</Chip>
            {detail ? <span className="truncate text-label text-fg-muted num">{detail}</span> : null}
          </div>
        );
      }
      case "lastPayment": {
        const date = shortDate(row.report.lastPaymentDate);
        return date ? <span className="whitespace-nowrap num">{date}</span> : <span className="text-fg-subtle">—</span>;
      }
      case "nextDue": {
        const date = row.report.subscriptionStatus === "CANCELLED" ? null : shortDate(row.report.nextDueDate);
        return date ? <span className="whitespace-nowrap num">{date}</span> : <span className="text-fg-subtle">—</span>;
      }
      case "health": {
        const badge = HEALTH_BADGE[row.report.health];
        return (
          <Chip tone={badge.tone} title={row.report.healthReason}>
            {badge.label}
          </Chip>
        );
      }
      case "ownerEmail":
        return <span className="block truncate">{row.report.ownerEmail}</span>;
      case "action":
        return canManageBilling && row.client && isOwed(row.payment.kind) ? (
          <Button variant="secondary" size="xs" startIcon={<IconSend aria-hidden />} onPress={() => remind([row])}>
            Send reminder
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  const mobileRow = (row: SubscriptionRow) => {
    const plan = row.client?.planRef?.displayName || getPlanLabel(row.report.plan);
    const next = shortDate(row.report.nextDueDate);
    const line2 = [plan, next ? `next due ${next}` : null, isOwed(row.payment.kind) ? `${money(row.owed)} due` : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-medium text-fg">{row.report.storeName}</p>
          <Chip tone={row.payment.tone}>{row.payment.label}</Chip>
        </div>
        <p className="mt-1 truncate text-label text-fg-muted num">{line2}</p>
      </>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const loading = api.loading || (clientsLoading && !clients.length);
  const activeFilters = countActiveFilters(drawerValue);
  const hasFilters = url.search.trim() !== "" || activeFilters > 0;
  const selectable = tab === subscriptionTabEnum.DUE && canManageBilling;

  const header = (
    <PageHeader
      type="list"
      icon={<IconPayments aria-hidden />}
      section="green"
      title="Subscriptions"
      count={loading ? undefined : allRows.length}
      description={
        loading
          ? "Who has paid, who is due and who is overdue"
          : `${formatCount(summary.paid)} paid ${isDefaultPeriod ? "this month" : "in this period"} · ${formatCount(summary.due)} due · ${formatCount(summary.overdue)} overdue · ${money(summary.toCollect)} to collect`
      }
      actions={
        <>
          <DateRangeComparison value={range} onChange={setRange} compare={false} />
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                variant="secondary"
                startIcon={<IconDownload aria-hidden />}
                endIcon={<IconCaret aria-hidden />}
                isLoading={exporting}
              >
                Export
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Export" onAction={(key) => void runExport(String(key))}>
              <DropdownItem key="subscriptions">Subscriptions (CSV)</DropdownItem>
              <DropdownItem key="invoices">Invoices (CSV)</DropdownItem>
              <DropdownItem key="payments">Payments (CSV)</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </>
      }
    />
  );

  const toolbar = (
    <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-col gap-2 border-b border-line-subtle bg-surface px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="flex min-w-0 items-center overflow-x-auto">
        <SegmentedSwitch<SubscriptionTab>
          ariaLabel="Subscription status"
          value={tab}
          onChange={setTab}
          items={SUBSCRIPTION_TABS.map((item) => ({ value: item.value, label: item.label, count: loading ? null : tabCounts[item.value] }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <SearchInput
          placement="toolbar"
          placeholder="Search stores"
          value={searchInput}
          onValueChange={setSearchInput}
          onClear={() => setSearchInput("")}
        />
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
            selectedKeys={new Set([...savedColumns].filter((key) => OPTIONAL_COLUMNS.some((c) => c.key === key)))}
            onSelectionChange={(keys) =>
              setSavedColumns(new Set(keys === "all" ? OPTIONAL_COLUMNS.map((c) => c.key) : Array.from(keys).map(String)))
            }
          >
            {OPTIONAL_COLUMNS.map((column) => (
              <DropdownItem key={column.key}>{column.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  );

  const emptyContent = hasFilters ? (
    <EmptyState kind="no-results" title="No subscriptions match these filters" onClearFilters={clearFilters} />
  ) : (
    <EmptyState icon={IconPayments} title={EMPTY_BY_TAB[tab].title} description={EMPTY_BY_TAB[tab].description} />
  );

  const selectedRows = rows.filter((row) => selected.has(row.id));

  return (
    <div>
      {header}
      {api.error ? (
        <ErrorState
          className="rounded-card border border-line bg-surface"
          title="Couldn't load subscriptions."
          description={toasts.genericError}
          onRetry={() => void api.refetch()}
        />
      ) : (
        <DataTable
          aria-label="Subscriptions"
          columns={columns}
          visibleColumns={visibleColumns}
          rows={pageRows}
          getRowKey={(row) => row.id}
          renderCell={renderCell}
          isLoading={loading}
          isReloading={api.reloading}
          rowHeight="tall"
          stickyFirstColumn
          toolbar={toolbar}
          bulkBar={
            selectable && selected.size > 0 ? (
              <SelectionBar
                count={selected.size}
                total={rows.length}
                onSelectAll={() => setSelected(new Set(rows.map((row) => row.id)))}
                onClear={() => setSelected(new Set())}
              >
                <Button variant="secondary" size="sm" startIcon={<IconSend aria-hidden />} onPress={() => remind(selectedRows)}>
                  Send reminder
                </Button>
              </SelectionBar>
            ) : undefined
          }
          selectedKeys={selectable ? selected : undefined}
          onSelectionChange={
            selectable
              ? (keys) => setSelected(keys === "all" ? new Set(pageRows.map((row) => row.id)) : new Set(Array.from(keys).map(String)))
              : undefined
          }
          chips={<AppliedFilters items={chips} onClearAll={clearFilters} />}
          footer={
            !loading && rows.length > 0 ? (
              <TablePagination
                page={page}
                pageSize={url.pageSize}
                total={rows.length}
                onPageChange={url.setPage}
                onPageSizeChange={url.setPageSize}
              />
            ) : null
          }
          onRowAction={(row) => navigate(billingHref(row))}
          rowActions={rowActions}
          rowActionsLabel={(row) => `Actions for ${row.report.storeName}`}
          mobileRow={mobileRow}
          emptyContent={emptyContent}
        />
      )}

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={groups}
        value={drawerValue}
        onApply={applyFilters}
        onClear={clearFilters}
        countResults={countResults}
      />

      <SendReminderDialog
        key={reminding.map((store) => store.id).join()}
        stores={reminding}
        onClose={() => {
          setReminding([]);
          setSelected(new Set());
          void apollo.refetchQueries({ include: ["PlatformReminderLog"] }).catch(() => undefined);
        }}
      />

      {dialog?.row.client ? (
        <SubscriptionDialogs
          key={`${dialog.row.id}-${dialog.kind}`}
          client={dialog.row.client}
          subscription={dialog.row.subscription}
          dialog={dialog.kind}
          onClose={() => {
            setDialog(null);
            void api.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
