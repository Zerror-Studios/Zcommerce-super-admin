/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * /dev/ui sections for design v1.4 (docs/design/08, 09): the three headers, the one search, segmented control,
 * two-pane card, image controls, grid/list toggle, avatars, and the data table at scale (10,000 sample rows
 * paged 50 at a time with a simulated server delay). Development builds only, via DevUiPage.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Selection } from "@heroui/react";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "./Button";
import { Card } from "./Card";
import { CellText, DataTable, type DataTableColumn } from "./DataTable";
import { IconTile } from "./IconTile";
import {
  IconAdd,
  IconBilling,
  IconDelete,
  IconDragHandle,
  IconEdit,
  IconGlobe,
  IconHelp,
  IconLocation,
  IconNotifications,
  IconOrders,
  IconPayments,
  IconSettings,
  IconShipping,
  IconStore,
  IconUser,
} from "./icons";
import { Avatar, CoverTag, ImageControl, useViewMode, ViewToggle } from "./Media";
import { formatMoney } from "./money";
import { SegmentedControl } from "./Primitives";
import { SearchInput } from "./SearchInput";
import { SelectionBar } from "./SelectionBar";
import { StatusChip } from "./StatusChip";
import { TablePagination } from "./TablePagination";
import type { TableSort } from "./table-state";
import { PaneHeader, PaneList, TwoPaneCard } from "./TwoPane";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

// ─── 10,000-row table ────────────────────────────────────────────────────────

interface DemoOrder {
  id: string;
  number: string;
  customer: string;
  status: "paid" | "pending" | "refunded";
  total: number;
  createdAt: number;
}

const NAMES = ["Aanya Shah", "Rohan Mehta", "Isha Kapoor", "Kabir Rao", "Meera Iyer", "Arjun Nair", "Diya Bose", "Vikram Singh"];
const STATUSES: DemoOrder["status"][] = ["paid", "paid", "paid", "pending", "refunded"];
const ORDERS: DemoOrder[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: String(index + 1),
  number: `#${String(100_000 - index).padStart(6, "0")}`,
  customer: NAMES[index % NAMES.length],
  status: STATUSES[index % STATUSES.length],
  total: 499 + ((index * 7919) % 9000),
  createdAt: Date.UTC(2026, 9, 24) - index * 3_600_000,
}));

const COLUMNS: DataTableColumn[] = [
  { key: "number", label: "Order", sortable: true },
  { key: "customer", label: "Customer", sortable: true },
  { key: "status", label: "Payment" },
  { key: "total", label: "Total", align: "end", sortable: true },
  { key: "actions", label: "Actions", hideLabel: true },
];

/** Behaves like a server: sorts and slices one page after a short delay. */
function useDemoPage(page: number, pageSize: number, sort: TableSort | undefined) {
  const [rows, setRows] = useState<DemoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      const sorted = sort
        ? [...ORDERS].sort((a, b) => {
            const key = sort.column as keyof DemoOrder;
            const order = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
            return sort.direction === "asc" ? order : -order;
          })
        : ORDERS;
      setRows(sorted.slice((page - 1) * pageSize, page * pageSize));
      setLoading(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [page, pageSize, sort]);
  return { rows, loading };
}

function DemoTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<TableSort | undefined>({ column: "number", direction: "desc" });
  const [selected, setSelected] = useState<Selection>(new Set());
  const { rows, loading } = useDemoPage(page, pageSize, sort);
  const count = selected === "all" ? ORDERS.length : selected.size;

  return (
    <DataTable<DemoOrder>
      aria-label="Orders (10,000 sample rows)"
      columns={COLUMNS}
      rows={rows}
      getRowKey={(row) => row.id}
      isLoading={loading && rows.length === 0}
      isReloading={loading && rows.length > 0}
      sort={sort}
      onSortChange={(next) => {
        setSort(next);
        setPage(1);
      }}
      selectedKeys={selected}
      onSelectionChange={setSelected}
      stickyFirstColumn
      scrollClassName="max-h-[60vh]"
      toolbar={
        <div className="flex min-h-13 items-center justify-between gap-3 border-b border-line px-4">
          <span className="text-label text-fg-muted">Sort by Order, Customer or Total</span>
          <SearchInput placement="toolbar" placeholder="Search orders" />
        </div>
      }
      bulkBar={
        <SelectionBar count={count} total={ORDERS.length} onSelectAll={() => setSelected("all")} onClear={() => setSelected(new Set())}>
          <Button variant="ghost" size="sm">Export</Button>
          <Button variant="ghost" size="sm">Archive</Button>
        </SelectionBar>
      }
      footer={
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={ORDERS.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          isDisabled={loading}
        />
      }
      renderCell={(row, key) => {
        switch (key) {
          case "number":
            return <span className="font-mono">{row.number}</span>;
          case "customer":
            return (
              <span className="flex items-center gap-2.5">
                <Avatar name={row.customer} size="sm" />
                <CellText>{row.customer}</CellText>
              </span>
            );
          case "status":
            return <StatusChip domain="payment" status={row.status} />;
          case "total":
            return formatMoney(row.total);
          case "actions":
            return <Button variant="secondary" size="sm">Ship now</Button>;
          default:
            return null;
        }
      }}
    />
  );
}

// ─── Two-pane demo ───────────────────────────────────────────────────────────

const SETTINGS_GROUPS = [
  { label: "Store", items: [
    { key: "details", label: "Store details", icon: <IconStore aria-hidden /> },
    { key: "domain", label: "Domain", icon: <IconGlobe aria-hidden /> },
    { key: "plan", label: "Plan & billing", icon: <IconBilling aria-hidden /> },
  ] },
  { label: "Store & checkout", items: [
    { key: "payments", label: "Payments", icon: <IconPayments aria-hidden /> },
    { key: "shipping", label: "Shipping & delivery", icon: <IconShipping aria-hidden /> },
    { key: "locations", label: "Locations", icon: <IconLocation aria-hidden /> },
  ] },
  { label: "Team", items: [{ key: "members", label: "Members", icon: <IconUser aria-hidden />, meta: 3 }] },
  { label: "Notifications", items: [
    { key: "sms", label: "SMS notifications", icon: <IconNotifications aria-hidden />, meta: <StatusChip domain="plan" status="inactive" label="Off" /> },
  ] },
];

function DemoTwoPane() {
  const [active, setActive] = useState("shipping");
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () =>
      SETTINGS_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      })),
    [query],
  );
  const label = SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => item.key === active)?.label;
  return (
    <TwoPaneCard
      showDetail
      back={{ href: "/dev/ui", label: "Settings" }}
      list={
        <PaneList
          aria-label="Settings sections"
          groups={groups}
          activeKey={active}
          onSelect={setActive}
          emptyContent="No settings match."
          search={<SearchInput placeholder="Search settings" size="sm" value={query} onValueChange={setQuery} />}
        />
      }
    >
      <PaneHeader
        title={label}
        description="Where you ship, how much it costs and how long it takes."
        actions={<Button startIcon={<IconAdd aria-hidden />}>Add shipping profile</Button>}
      />
      <Card title="General profile" description="All products · 2 locations" actions={<Button variant="ghost" size="sm">Edit rates</Button>}>
        <p className="text-body text-fg-muted">Domestic · ₹49 under ₹999, free above.</p>
      </Card>
    </TwoPaneCard>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

export default function DevUiV14() {
  const [segment, setSegment] = useState("all");
  const [view, setView] = useViewMode("dev-ui");

  return (
    <>
      <Section title="Headers (09 §2: A list · B page · C detail)">
        <PageHeader
          type="list"
          section="amber"
          icon={<IconOrders />}
          title="Orders"
          count="1,284"
          description="12 to ship today · 2 awaiting payment · ₹4,417.34 in shipping wallet"
          actions={
            <>
              <Button variant="secondary">Shipping wallet</Button>
              <Button startIcon={<IconAdd aria-hidden />}>Create order</Button>
            </>
          }
        />
        <PageHeader
          type="page"
          section="slate"
          icon={<IconHelp />}
          title="Help & learn"
          description="Videos and answers for running your store on Zcom."
          actions={<SearchInput placement="header" placeholder="Search tutorials and questions" />}
        />
        <PageHeader
          type="detail"
          sticky={false}
          back={{ href: "/dev/ui", label: "Orders" }}
          title={`Order #${"000057"}`}
          badges={
            <>
              <StatusChip domain="payment" status="paid" />
              <StatusChip domain="fulfillment" status="unfulfilled" />
            </>
          }
          description="21 Oct 2026, 11:50 am · Online store · Customer"
          actions={
            <>
              <Button variant="ghost">Print</Button>
              <Button variant="ghost">Refund</Button>
              <Button>Ship now</Button>
            </>
          }
        />
      </Section>

      <Section title="Icon tiles (section colours)">
        <div className="flex flex-wrap gap-3">
          {(["blue", "violet", "teal", "green", "amber", "coral", "pink", "slate"] as const).map((section) => (
            <span key={section} className="flex items-center gap-2 text-label text-fg-muted">
              <IconTile section={section}><IconSettings /></IconTile>
              <IconTile section={section} size="md"><IconOrders /></IconTile>
              {section}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Search (one component) and segmented control (32px)">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placement="toolbar" placeholder="Search products" />
          <SearchInput placement="header" placeholder="Search settings" />
          <SegmentedControl
            aria-label="Visitors"
            value={segment}
            onChange={setSegment}
            options={[
              { value: "all", label: "All visitors" },
              { value: "mobile", label: "Mobile" },
              { value: "desktop", label: "Desktop" },
            ]}
          />
          <ViewToggle value={view} onChange={setView} />
        </div>
      </Section>

      <Section title="Two-pane card (09 §1, §2B)">
        <DemoTwoPane />
      </Section>

      <Section title="Data table at scale (09 §3: 10,000 rows, 50 per page, sort, select all, sticky name)">
        <DemoTable />
      </Section>

      <Section title="Image controls, cover tag, avatars">
        <div className="flex flex-wrap items-center gap-6">
          <div className="group relative size-40 overflow-hidden rounded-thumb bg-surface-sunken">
            <CoverTag className="absolute left-2 top-2" />
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <ImageControl aria-label="Edit image" onPress={() => undefined}><IconEdit /></ImageControl>
              <ImageControl aria-label="Delete image" destructive onPress={() => undefined}><IconDelete /></ImageControl>
            </div>
            <ImageControl aria-label="Drag to reorder" size="sm" className="absolute bottom-2 left-2" onPress={() => undefined}>
              <IconDragHandle />
            </ImageControl>
          </div>
          <div className="flex items-center gap-2">
            {NAMES.slice(0, 6).map((name) => (
              <Avatar key={name} name={name} size="lg" />
            ))}
            <Avatar name="Nira Home" size="md" />
            <Avatar name="Nira Home" size="sm" />
          </div>
          <p className="text-label text-fg-muted num">{formatMoney(124500)} · tabular figures</p>
        </div>
      </Section>
    </>
  );
}
