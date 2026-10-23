import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useMemo, useState, type Key } from "react";
import { Link, useNavigate } from "react-router-dom";
import { subscriptionStatusEnum, type Client, type ClientStatus, type Subscription } from "../../types";
import { getPlanLabel, PLAN_LABELS, PLAN_NAMES } from "../../lib/display-labels.util";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { getStoreHealth } from "../../lib/storeHealth";
import { paymentState, storeLifecycle } from "../../lib/storeStatus";
import { dataTableClassNames } from "../common/dataTableStyles";
import { FilterCheckboxGroup, TableToolbar } from "../common/TableToolbar";
import { RenewalBadge } from "../common/RenewalBadge";
import { StoreHealthCell } from "../common/StoreHealthCell";
import {
  Button as UiButton,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  EmptyState,
  IconButton,
  Skeleton,
  Tab,
  Tabs,
  cx,
  formatMoney,
  menuItemDangerClasses,
  tablePanelClasses,
} from "../ui";
import { IconLogin, IconMore, IconSearch, IconStore } from "../ui/icons";
import { StoreActionDialog, type StoreAction } from "./storeActions";
import { logInToStore } from "./storeLogin";
import { emptyStates } from "../../copy";

export type StoreTab = "all" | "live" | "trial" | "unpaid" | "suspended";

export interface ClientsTableProps {
  clients: Client[];
  isLoading?: boolean;
  /** Home: show only the first N rows and a "View all stores" link instead of pagination. */
  previewLimit?: number;
  /** Stores page: offer the optional columns (Plan, Renewal) through Columns. */
  allowColumnChoice?: boolean;
  initialTab?: StoreTab;
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

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align?: "start" | "end";
  allowsSorting?: boolean;
}

const PAGE_SIZE = 10;

const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date());

const allColumns: ColumnDef[] = [
  { key: "storeName", label: "Store", allowsSorting: true },
  { key: "status", label: "Status", allowsSorting: true },
  { key: "payment", label: `${monthName} payment`, allowsSorting: true },
  { key: "storeHealth", label: "Health", allowsSorting: true },
  { key: "sales", label: "Store sales · 30d", align: "end", allowsSorting: true },
  { key: "mrr", label: "Monthly fee", align: "end", allowsSorting: true },
  { key: "plan", label: "Plan", allowsSorting: true },
  { key: "renewalDate", label: "Renewal", allowsSorting: true },
];

/** Shown by default; Plan and Renewal are optional columns (docs/design/04-super-admin.md §3.3). */
const defaultColumnKeys: ColumnKey[] = ["storeName", "status", "payment", "storeHealth", "sales", "mrr"];

const statusLabels: Record<ClientStatus, string> = { active: "Live", trial: "Trial", suspended: "Suspended" };

/** Unpaid = something issued and not yet paid (the server's open-invoice rule, as in Collections). */
function isUnpaid(subscription?: Subscription): boolean {
  return (
    subscription != null &&
    (subscription.status === subscriptionStatusEnum.ACTIVE ||
      subscription.status === subscriptionStatusEnum.PAST_DUE) &&
    subscription.amountDue > 0
  );
}

function matchesTab(tab: StoreTab, client: Client, subscription?: Subscription): boolean {
  switch (tab) {
    case "live":
      return client.status === "active";
    case "trial":
      return client.status === "trial";
    case "suspended":
      return client.status === "suspended";
    case "unpaid":
      return isUnpaid(subscription);
    default:
      return true;
  }
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

function compareClients(a: Client, b: Client, column: ColumnKey, byClientId: Map<string, Subscription>): number {
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
    case "actions":
      return 0;
    default: {
      const left = a[column as keyof Client];
      const right = b[column as keyof Client];
      return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    }
  }
}

/**
 * The stores table card (docs/design/04-super-admin.md §3.1, §3.3): status tabs, search, Filter and Columns
 * on one row; Store · Status · {Month} payment · Health · Store sales · 30d · Monthly fee; a visible "Log in"
 * and a "···" menu per row. Used by Home (first rows + "View all stores") and the Stores page.
 */
export function ClientsTable({
  clients,
  isLoading,
  previewLimit,
  allowColumnChoice = false,
  initialTab = "all",
}: ClientsTableProps) {
  const navigate = useNavigate();
  const { subscriptions } = useClients();
  const { can } = useAuth();
  // Client-side mirror of the backend guard (review C-M5): the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const [tab, setTab] = useState<StoreTab>(initialTab);
  const [search, setSearch] = useState("");
  const [plans, setPlans] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumnKeys);
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "storeName",
    direction: "ascending",
  });
  const [pending, setPending] = useState<{ client: Client; action: StoreAction } | null>(null);


  const subscriptionByClientId = useMemo(() => latestSubscriptionByClient(subscriptions), [subscriptions]);

  // Search and Filter apply first; the tab counts are taken from that set.
  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.storeName.toLowerCase().includes(query) ||
        client.ownerEmail.toLowerCase().includes(query) ||
        client.ownerName.toLowerCase().includes(query);
      const matchesPlan = plans.length === 0 || plans.includes(client.plan);
      const matchesStatus = statuses.length === 0 || statuses.includes(client.status);
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [clients, plans, search, statuses]);

  const tabCounts = useMemo(() => {
    const counts: Record<StoreTab, number> = { all: 0, live: 0, trial: 0, unpaid: 0, suspended: 0 };
    searched.forEach((client) => {
      const sub = subscriptionByClientId.get(client.id);
      (Object.keys(counts) as StoreTab[]).forEach((key) => {
        if (matchesTab(key, client, sub)) counts[key] += 1;
      });
    });
    return counts;
  }, [searched, subscriptionByClientId]);

  const filtered = useMemo(
    () => searched.filter((client) => matchesTab(tab, client, subscriptionByClientId.get(client.id))),
    [searched, subscriptionByClientId, tab],
  );

  const sorted = useMemo(() => {
    const column = (sortDescriptor.column as ColumnKey) ?? "storeName";
    const items = [...filtered].sort((a, b) => compareClients(a, b, column, subscriptionByClientId));
    return sortDescriptor.direction === "descending" ? items.reverse() : items;
  }, [filtered, sortDescriptor, subscriptionByClientId]);

  const pageSize = previewLimit ?? PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = previewLimit ? 1 : Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [pageSize, safePage, sorted]);

  const headerColumns = useMemo<ColumnDef[]>(
    () => [
      ...allColumns.filter((column) => visibleColumns.includes(column.key)),
      { key: "actions", label: "Actions", align: "end" },
    ],
    [visibleColumns],
  );

  const hasFilters = search.trim() !== "" || plans.length > 0 || statuses.length > 0;
  const resetToFirstPage = () => setPage(1);
  const clearFilters = () => {
    setSearch("");
    setPlans([]);
    setStatuses([]);
    setTab("all");
    resetToFirstPage();
  };

  const onMenuAction = (client: Client, key: Key) => {
    switch (String(key)) {
      case "view":
        navigate(`/stores/${client.id}`);
        break;
      case "login":
        void logInToStore(client);
        break;
      case "suspend":
      case "reactivate":
      case "delete":
        setPending({ client, action: String(key) as StoreAction });
        break;
    }
  };

  const renderCell = (client: Client, key: ColumnKey) => {
    const subscription = subscriptionByClientId.get(client.id);

    switch (key) {
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
              <p className="truncate text-caption text-fg-subtle">{client.ownerEmail}</p>
            </div>
          </div>
        );
      case "status": {
        const lifecycle = storeLifecycle(client);
        return <Chip tone={lifecycle.tone}>{lifecycle.label}</Chip>;
      }
      case "payment": {
        const state = paymentState(subscription);
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Chip tone={state.tone}>{state.label}</Chip>
            {state.detail ? <span className="text-caption text-fg-muted">{state.detail}</span> : null}
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
        return <span>{getPlanLabel(client.plan)}</span>;
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
                variant="ghost"
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
                <DropdownSection showDivider={canManage} aria-label="Store">
                  <DropdownItem key="view">View details</DropdownItem>
                  {canImpersonate ? <DropdownItem key="login">Log in</DropdownItem> : null}
                  {canManage ? (
                    <DropdownItem key={isSuspended ? "reactivate" : "suspend"}>
                      {isSuspended ? "Reactivate store" : "Suspend store"}
                    </DropdownItem>
                  ) : null}
                </DropdownSection>
                {canManage ? (
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

  const tabItems: { key: StoreTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "trial", label: "Trial" },
    { key: "unpaid", label: "Unpaid" },
    { key: "suspended", label: "Suspended" },
  ];

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
    ) : tab === "unpaid" && !hasFilters ? (
      <EmptyState icon={IconStore} title={emptyStates.unpaid.title} description={emptyStates.unpaid.description} />
    ) : (
      <EmptyState
        icon={IconSearch}
        title={search.trim() ? emptyStates.noResults(search.trim()).title : "No stores match"}
        description={emptyStates.noResults("").description}
        action={
          <UiButton variant="secondary" onPress={clearFilters}>
            {emptyStates.noResults("").action}
          </UiButton>
        }
      />
    );

  const firstRow = sorted.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(safePage * pageSize, sorted.length);

  return (
    <section className={tablePanelClasses}>
      <TableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetToFirstPage();
        }}
        searchPlaceholder="Search stores or owners"
        columns={
          allowColumnChoice
            ? allColumns.map((column) => ({ key: column.key, label: column.label }))
            : undefined
        }
        visibleColumns={allowColumnChoice ? visibleColumns : undefined}
        onVisibleColumnsChange={allowColumnChoice ? setVisibleColumns : undefined}
        tabs={
          <Tabs
            aria-label="Store status"
            selectedKey={tab}
            onSelectionChange={(key) => {
              setTab(String(key) as StoreTab);
              resetToFirstPage();
            }}
            classNames={{ base: "min-w-0 max-w-full self-stretch", tabList: "h-full border-b-0", tab: "h-13", panel: "hidden" }}
          >
            {tabItems.map((item) => (
              <Tab
                key={item.key}
                title={
                  <span className="flex items-center gap-1.5">
                    {item.label}
                    <span className="font-normal text-fg-subtle num">{tabCounts[item.key]}</span>
                  </span>
                }
              />
            ))}
          </Tabs>
        }
        filterContent={
          <>
            <FilterCheckboxGroup
              label="Plan"
              options={PLAN_NAMES.map((planOption) => ({
                key: planOption,
                label: PLAN_LABELS[planOption],
              }))}
              value={plans}
              onChange={(value) => {
                setPlans(value);
                resetToFirstPage();
              }}
            />
            <FilterCheckboxGroup
              label="Status"
              options={(["active", "trial", "suspended"] as ClientStatus[]).map((statusOption) => ({
                key: statusOption,
                label: statusLabels[statusOption],
              }))}
              value={statuses}
              onChange={(value) => {
                setStatuses(value);
                resetToFirstPage();
              }}
            />
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <Table
          aria-label="Stores"
          sortDescriptor={sortDescriptor}
          onSortChange={(descriptor) => {
            setSortDescriptor(descriptor);
            resetToFirstPage();
          }}
          classNames={{
            ...dataTableClassNames,
            // The table shows at most 10 rows per page, so it grows with its rows instead of scrolling inside.
            wrapper: "p-0 shadow-none rounded-none overflow-x-auto",
            // No selection column, so the first column isn't the 48px checkbox column.
            th: dataTableClassNames.th.replace("first:w-12 ", ""),
            td: dataTableClassNames.td.replace("first:w-12 ", ""),
          }}
        >
          <TableHeader columns={headerColumns}>
            {(column) => (
              <TableColumn
                key={column.key}
                align={column.align ?? "start"}
                allowsSorting={column.allowsSorting ?? false}
                className={cx(column.align === "end" && "text-end")}
              >
                {column.key === "actions" ? <span className="sr-only">{column.label}</span> : column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={pageItems} emptyContent={emptyContent}>
            {(client) => (
              <TableRow key={client.id} className="cursor-pointer" onClick={() => navigate(`/stores/${client.id}`)}>
                {(columnKey) => (
                  <TableCell className={cx(String(columnKey) === "sales" || String(columnKey) === "mrr" ? "text-end" : undefined)}>
                    {renderCell(client, String(columnKey) as ColumnKey)}
                  </TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {!isLoading && sorted.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-4 py-3">
          {previewLimit ? (
            <>
              <p className="text-caption text-fg-muted num">
                Showing {lastRow} of {sorted.length} {sorted.length === 1 ? "store" : "stores"}
              </p>
              <Link to="/stores" className="text-label font-medium text-brand hover:underline">
                View all stores
              </Link>
            </>
          ) : (
            <>
              <p className="text-caption text-fg-muted num">
                {firstRow}–{lastRow} of {sorted.length}
              </p>
              {pageCount > 1 ? (
                <div className="flex items-center gap-2">
                  <UiButton variant="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(safePage - 1)}>
                    Previous
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    size="sm"
                    isDisabled={safePage >= pageCount}
                    onPress={() => setPage(safePage + 1)}
                  >
                    Next
                  </UiButton>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <StoreActionDialog client={pending?.client ?? null} action={pending?.action ?? null} onClose={() => setPending(null)} />
    </section>
  );
}
