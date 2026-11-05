/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * /dev/ui sections for design v2 (docs/design-v2/README.md §3.4, §4): the title row with ⋯, the summary panel
 * (open, collapsed, attention tones, lite), the toolbar above the table with the row chevron and "+N" thumbnails,
 * pop-ups in three sizes with the icon title row, the orb and its states, the AI card and line, the SEO ring, video
 * thumbnails, the wallet capsule and the view switch. Then the board-audit additions: the white on-dark button,
 * status icon tiles, the grey-tile discard dialog, tinted and expandable rows, a linked row chevron, underline tabs
 * and Inbox filter chips, a card with a leading ring, the title eyebrow, the route skeleton and the AI composer.
 * Numbers are sample data. Development builds only.
 */
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { Tab } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { AiComposer } from "../layout/AiSheet";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "./Button";
import { Card } from "./Card";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, type DataTableColumn } from "./DataTable";
import { FilterDrawer } from "./FilterDrawer";
import { IconButton } from "./IconButton";
import {
  IconAnalytics,
  IconBox,
  IconCard,
  IconCustomers,
  IconInbox,
  IconTruck,
  IconWarning,
  IconExport,
  IconImport,
  IconLogout,
  IconOrders,
  IconColumns,
  IconInvoice,
  IconSettings,
  IconTag,
} from "./icons";
import { IconTile } from "./IconTile";
import { Modal, PopupTitle, type ModalWidth } from "./Modal";
import type { ViewMode } from "./Media";
import { AiCard, AiLine, Orb, type OrbState } from "./Orb";
import { ProgressRing } from "./ProgressRing";
import { RouteSkeleton } from "./RouteSkeleton";
import { StatusChip } from "./StatusChip";
import { SummaryPanel, type SummaryCell } from "./SummaryPanel";
import { RowChevron, TableToolbar, ThumbWithCount, ViewSwitch } from "./TableToolbar";
import { SegmentedSwitch, TabLabel, Tabs } from "./Tabs";
import { SeoScore, VideoThumb, WalletCapsule, videoLookAt } from "./V2Display";
import { formatMoney } from "./money";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title-3 text-fg">{title}</h2>
      {children}
    </section>
  );
}

const SUMMARY: SummaryCell[] = [
  { key: "month", label: "Orders this month", value: "1,284", note: "Up 12% on October", chart: { kind: "bars", values: [4, 6, 5, 8, 7, 9, 8, 11, 10, 12] } },
  { key: "pack", label: "To pack", value: "38", note: "12 since this morning", chart: { kind: "segments", filled: 6 } },
  { key: "way", label: "On the way", value: "45", note: "35 delivered this week", chart: { kind: "dots" } },
  { key: "unpaid", label: "Waiting for payment", value: formatMoney(48210), note: "9 orders, oldest 3 days", tone: "warning", chart: { kind: "ring", percent: 64 } },
];

interface SampleOrder {
  id: string;
  number: string;
  date: string;
  customer: string;
  items: number;
  payment: string;
  delivery: string;
  total: number;
}

const ORDERS: SampleOrder[] = [
  { id: "1", number: "#1880", date: "4 Nov, 10:12", customer: "Rahul Agarwal", items: 2, payment: "paid", delivery: "shipped", total: 4890 },
  { id: "2", number: "#1879", date: "4 Nov, 09:40", customer: "Ananya Iyer", items: 1, payment: "pending", delivery: "unfulfilled", total: 1299 },
  { id: "3", number: "#1878", date: "3 Nov, 18:05", customer: "Kabir Mehta", items: 4, payment: "paid", delivery: "delivered", total: 12450 },
];

const COLUMNS: DataTableColumn[] = [
  { key: "order", label: "Order", width: 150 },
  { key: "items", label: "Items", width: 90, skeleton: "thumb" },
  { key: "customer", label: "Customer" },
  { key: "payment", label: "Payment", width: 140, skeleton: "badge" },
  { key: "delivery", label: "Delivery", width: 140, skeleton: "badge" },
  { key: "total", label: "Total", width: 120, align: "end" },
];

function renderOrderCell(row: SampleOrder, key: string): ReactNode {
  switch (key) {
    case "order":
      return (
        <span className="flex flex-col">
          <span className="font-medium text-fg num">{row.number}</span>
          <span className="text-caption text-fg-subtle">{row.date}</span>
        </span>
      );
    case "items":
      return <ThumbWithCount more={row.items - 1} size={36} />;
    case "customer":
      return row.customer;
    case "payment":
      return <StatusChip domain="payment" status={row.payment} />;
    case "delivery":
      return <StatusChip domain="fulfillment" status={row.delivery} />;
    case "total":
      return formatMoney(row.total);
    default:
      return null;
  }
}

const ORB_STATES: OrbState[] = ["idle", "listening", "thinking", "done"];

interface SampleStore {
  id: string;
  name: string;
  owner: string;
  plan: string;
  status: string;
  tone?: "danger" | "warning";
}

const STORES: SampleStore[] = [
  { id: "kk", name: "Kesar & Kin", owner: "Aarav Mehta", plan: "Growth", status: "live" },
  { id: "na", name: "Nahara", owner: "Naina Hasan", plan: "Starter", status: "past_due", tone: "danger" },
  { id: "ve", name: "Vellum", owner: "Ira Sen", plan: "Starter", status: "trial", tone: "warning" },
];

const STORE_COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Store", mobile: "primary" },
  { key: "owner", label: "Owner", width: 200, mobile: "title" },
  { key: "plan", label: "Plan", width: 120 },
  { key: "status", label: "Billing", width: 160, mobile: "badge" },
];

const PROFILE_TABS = [
  { value: "orders", label: "Orders", count: 6 },
  { value: "messages", label: "Messages" },
  { value: "notes", label: "Notes" },
];

const INBOX_FILTERS = [
  { value: "reply", label: "To reply", count: 9 },
  { value: "mine", label: "Mine", count: 3 },
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
];

export default function DevUiV2() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [filterOpen, setFilterOpen] = useState(false);
  const [popup, setPopup] = useState<ModalWidth | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "logout" | null>(null);
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [expandedStores, setExpandedStores] = useState<Set<string>>(() => new Set(["na"]));
  const [profileTab, setProfileTab] = useState("orders");
  const [inboxFilter, setInboxFilter] = useState("reply");
  const [question, setQuestion] = useState("");

  return (
    <div className="flex flex-col gap-10 border-t border-line pt-10">
      <h1 className="text-title-1 text-fg">Design v2 components</h1>

      <Section title="Title row: 44px ink tile, title + count, status line, one secondary + one primary, then ⋯">
        <PageHeader
          type="list"
          icon={<IconOrders />}
          title="Orders"
          count="1,284"
          description="38 to pack today · 9 waiting for payment"
          actions={
            <>
              <WalletCapsule balance={4820} dailySpend={690} onAddMoney={() => undefined} onShippingCosts={() => undefined} autoRecharge={{ enabled: autoRecharge, amount: 5000, threshold: 2000, onChange: setAutoRecharge }} />
              <Button variant="primary">Create order</Button>
            </>
          }
          more={[
            { key: "export", label: "Export orders", icon: IconExport },
            { key: "import", label: "Import", icon: IconImport },
            { key: "labels", label: "Print shipping labels", icon: IconInvoice },
            { key: "columns", label: "Choose columns", icon: IconColumns },
          ]}
          moreLabel="More order actions"
        />
      </Section>

      <Section title="Summary panel: four cells, attention tones only where needed, collapse remembered per page">
        <SummaryPanel cells={SUMMARY} storageKey="dev-ui:orders" aria-label="Orders summary" />
        <SummaryPanel
          cells={[
            { key: "live", label: "Live products", value: "248", chart: { kind: "bars", values: [3, 4, 4, 5, 6, 6, 7, 7] } },
            { key: "sold", label: "Sold · 30d", value: "1,902" },
            { key: "low", label: "Running low", value: "14", note: "3 sell out this week", tone: "danger" },
            { key: "none", label: "Opened, no sales", value: "21", note: "Viewed 40+ times" },
          ]}
          defaultCollapsed
          aria-label="Products summary (collapsed)"
        />
        <SummaryPanel
          variant="lite"
          cells={[
            { key: "visitors", label: "Visitors", value: "18,420", chart: { kind: "bars", values: [5, 6, 7, 6, 8, 9, 8, 10] } },
            { key: "buy", label: "Visitors who buy", value: "2.4%" },
            { key: "returns", label: "Returns & RTO", value: "6.1%", tone: "warning", chart: { kind: "ring", percent: 61 } },
            { key: "sold-out", label: "Sold out", value: "7", tone: "danger" },
          ]}
          aria-label="Analytics extra cards (lite)"
        />
      </Section>

      <Section title="Toolbar above the table · rows with the date under the number · one photo + N · row chevron">
        <DataTable<SampleOrder>
          aria-label="Sample orders"
          columns={COLUMNS}
          rows={ORDERS}
          getRowKey={(row) => row.id}
          renderCell={renderOrderCell}
          onRowAction={() => undefined}
          rowActions={() => [{ key: "open", label: "Open" }, { key: "cancel", label: "Cancel order", destructive: true }]}
          toolbar={
            <TableToolbar<string>
              tabs={[
                { value: "all", label: "All", count: 300 },
                { value: "pack", label: "To pack", count: 38 },
                { value: "way", label: "On the way", count: 45 },
                { value: "delivered", label: "Delivered", count: 190 },
                { value: "unpaid", label: "Not paid", count: 9 },
                { value: "returns", label: "Returns & RTO", count: 12 },
                { value: "abandoned", label: "Abandoned", count: 23 },
              ]}
              tab={tab}
              onTabChange={setTab}
              tabsLabel="Order status"
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search orders"
              onOpenFilters={() => setFilterOpen(true)}
              filterCount={tab === "all" ? 0 : 2}
              sort={{ options: [{ key: "new", label: "Newest first" }, { key: "old", label: "Oldest first" }, { key: "total", label: "Highest total" }], value: "new", onChange: () => undefined }}
              view={{ value: view, onChange: setView }}
            />
          }
        />
        <FilterDrawer
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          groups={[
            { key: "status", label: "Payment", type: "options", options: [{ value: "paid", label: "Paid" }, { value: "pending", label: "Waiting" }, { value: "failed", label: "Failed" }] },
            { key: "channel", label: "Channel", type: "options", options: [{ value: "store", label: "Online store" }, { value: "ig", label: "Instagram" }, { value: "wa", label: "WhatsApp" }] },
          ]}
          value={{}}
          onApply={() => setFilterOpen(false)}
          countResults={() => 24}
          totalCount={300}
          noun="orders"
        />
      </Section>

      <Section title="Buttons: pills; primary blue, secondary light blue, dark ink, red only for delete · icon buttons ink when active">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Save</Button>
          <Button variant="secondary">New group</Button>
          <Button variant="dark">Mark done</Button>
          <Button variant="destructive">Delete product</Button>
          <Button variant="primary" size="sm">Small</Button>
          <IconButton aria-label="Settings" variant="default"><IconSettings aria-hidden /></IconButton>
          <IconButton aria-label="Settings (active)" variant="default" className="zc-icon-btn--active"><IconSettings aria-hidden /></IconButton>
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </Section>

      <Section title="Pop-ups: three sizes, icon in the title row, Cancel then the action">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onPress={() => setPopup("sm")}>Small 420</Button>
          <Button variant="secondary" onPress={() => setPopup("md")}>Medium 640</Button>
          <Button variant="secondary" onPress={() => setPopup("lg")}>Large 960</Button>
          <Button variant="secondary" onPress={() => setConfirm("delete")}>Delete this product?</Button>
          <Button variant="secondary" onPress={() => setConfirm("logout")}>Log out?</Button>
        </div>
        <Modal isOpen={popup != null} onOpenChange={(open) => !open && setPopup(null)} width={popup ?? "sm"}>
          <ModalContent>
            {(close) => (
              <>
                <ModalHeader>
                  <PopupTitle icon={popup === "lg" ? <IconCustomers aria-hidden /> : <IconTag aria-hidden />} description="Sample pop-up body.">
                    {popup === "lg" ? "New customer group" : popup === "md" ? "Add a tag" : "Leave without saving?"}
                  </PopupTitle>
                </ModalHeader>
                <ModalBody>
                  <p className="text-body text-fg-muted">Size {popup === "sm" ? "small, 420px" : popup === "md" ? "medium, 640px" : "large, 960px"}.</p>
                </ModalBody>
                <ModalFooter>
                  <Button variant="secondary" onPress={close}>Cancel</Button>
                  <Button variant="primary" onPress={close}>Save</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
        <ConfirmDialog
          isOpen={confirm === "delete"}
          onClose={() => setConfirm(null)}
          onConfirm={() => setConfirm(null)}
          title="Delete this product?"
          description="It comes off your store and every collection. Orders that have it keep their records."
          confirmLabel="Delete product"
          secondaryAction={<Button variant="tertiary" size="sm" onPress={() => setConfirm(null)}>Archive instead</Button>}
          object={
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-thumb bg-surface-sunken text-fg-muted"><IconBox aria-hidden className="size-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-body-strong text-fg">Kesar silk kurta, maroon</p>
                <p className="text-label text-fg-muted">{formatMoney(2499)} · 18 in stock · Festive, New in</p>
              </div>
            </div>
          }
        />
        <ConfirmDialog
          isOpen={confirm === "logout"}
          onClose={() => setConfirm(null)}
          onConfirm={() => setConfirm(null)}
          tone="neutral"
          icon={<IconLogout aria-hidden />}
          title="Log out of Kesar & Kin?"
          confirmLabel="Log out"
        />
      </Section>

      <Section title="On dark: the white button for the one main action on the hero (boards 01, 02)">
        <div className="flex flex-wrap items-center gap-2 rounded-banner bg-ink p-6">
          <Button variant="glass" size="sm">Announce</Button>
          <Button variant="on-dark" size="sm">Create store</Button>
          <Button variant="on-dark" startIcon={<IconInbox aria-hidden />}>Open inbox</Button>
        </div>
      </Section>

      <Section title="Icon tiles: ink, neutral, danger, and the status tones success and info (board 14)">
        <div className="flex flex-wrap items-center gap-3">
          <IconTile tone="ink"><IconInbox /></IconTile>
          <IconTile tone="neutral" size="md"><IconBox /></IconTile>
          <IconTile tone="danger" size="md"><IconWarning /></IconTile>
          <IconTile tone="success" size="md"><IconCard /></IconTile>
          <IconTile tone="info" size="md"><IconTruck /></IconTile>
          <Button variant="secondary" onPress={() => setDiscardOpen(true)}>Leave without saving?</Button>
        </div>
        <ConfirmDialog
          isOpen={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onConfirm={() => setDiscardOpen(false)}
          tileTone="neutral"
          title="Leave without saving?"
          description="Your changes to this product will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
        />
      </Section>

      <Section title="Rows: a light tint for failing and past-due rows, expandable detail rows, a linked chevron (boards 59, 63)">
        <DataTable<SampleStore>
          aria-label="Sample stores"
          columns={STORE_COLUMNS}
          rows={STORES}
          getRowKey={(row) => row.id}
          renderCell={(row, key) =>
            key === "status" ? (
              <StatusChip domain="plan" status={row.status} />
            ) : (
              (row[key as keyof SampleStore] ?? null)
            )
          }
          onRowAction={() => undefined}
          rowTone={(row) => row.tone}
          renderExpanded={(row) => (
            <div className="grid gap-3 sm:grid-cols-3">
              {["Billing", "Health", "Last order"].map((label) => (
                <div key={label} className="rounded-photo border border-line bg-surface p-3">
                  <p className="text-caption text-fg-subtle">{label}</p>
                  <p className="text-body text-fg">{row.name}: sample detail</p>
                </div>
              ))}
            </div>
          )}
          expandedKeys={expandedStores}
          onExpandedChange={setExpandedStores}
          expandLabel={(row) => `Details for ${row.name}`}
        />
        <div className="flex items-center gap-3 text-label text-fg-muted">
          <RowChevron href="/dev/ui" aria-label="Open the sample store" /> link
          <RowChevron onPress={() => undefined} aria-label="Open the sample store" /> button
          <RowChevron /> decorative
        </div>
      </Section>

      <Section title="Tabs: underline for in-card and profile tabs (boards 24, 60) · chips for the Inbox list filters (board 23)">
        <div className="flex flex-col gap-4 rounded-card-lg border border-line bg-surface p-5">
          <SegmentedSwitch variant="underline" items={PROFILE_TABS} value={profileTab} onChange={setProfileTab} ariaLabel="Customer profile" />
          <Tabs variant="underline" aria-label="Store sections">
            <Tab key="overview" title="Overview" />
            <Tab key="billing" title={<TabLabel label="Billing" count={2} />} />
            <Tab key="team" title="Team" />
          </Tabs>
          <SegmentedSwitch variant="chips" items={INBOX_FILTERS} value={inboxFilter} onChange={setInboxFilter} ariaLabel="Show conversations" />
        </div>
      </Section>

      <Section title="Card with a leading visual (board 60) · photos at 14px (rounded-photo) · title eyebrow without a tile (boards 03, 43)">
        <div className="grid gap-4 md:grid-cols-2">
          <Card leading={<ProgressRing value={82} size={40} label="Store health 82" />} title="Store health" description="Healthy · checked 5 min ago">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <span key={index} className="aspect-square rounded-photo bg-surface-sunken" />
              ))}
            </div>
          </Card>
          <PageHeader type="page" icon={<IconAnalytics />} hideTile eyebrow="Analytics · 6 Oct – 4 Nov" title="Overview" />
        </div>
      </Section>

      <Section title="Route loading: the frame at once, rows after 300ms, a 2px line on top after 300ms (board 47)">
        <div className="rounded-card-lg bg-page p-4">
          <RouteSkeleton progress={false} />
        </div>
      </Section>

      <Section title="Zcom AI composer: pill field, round blue send, the note under it (board 46)">
        <AiComposer value={question} onValueChange={setQuestion} onSubmit={() => setQuestion("")} canSend={!!question.trim()} meta={`${question.length}/500`} />
      </Section>

      <Section title="Orb glyph: idle, listening, thinking, done · sizes 18 / 28 / 30 · white on dark">
        <div className="flex flex-wrap items-center gap-6">
          {ORB_STATES.map((state) => (
            <span key={state} className="flex items-center gap-2 text-label text-fg-muted">
              <Orb state={state} size="lg" /> {state}
            </span>
          ))}
          <Orb />
          <Orb size="bar" />
          <span className="rounded-card bg-ink p-3"><Orb onDark size="lg" /></span>
        </div>
      </Section>

      <Section title="AI card and insight line">
        <div className="grid gap-4 md:grid-cols-2">
          <AiCard
            headline="Checkout has failed for 11 days"
            body="Razorpay rejects cards from three banks. 14 orders worth ₹4,96,300 didn't go through."
            actions={
              <>
                <Button variant="secondary" size="sm">Fix checkout</Button>
                <Button variant="ghost" size="sm">Later</Button>
              </>
            }
          />
          <div className="flex flex-col gap-3">
            <AiLine action={<Button variant="tertiary" size="sm">See them</Button>}>Seven sizes of the lehenga sell out this week.</AiLine>
            <AiLine>Customers who bought twice in 90 days spend 3× more.</AiLine>
          </div>
        </div>
      </Section>

      <Section title="SEO score: green 80+, amber 60–79, red under 60">
        <div className="flex flex-wrap items-center gap-8">
          <SeoScore score={92} />
          <SeoScore score={68} hint="Add 2 keywords" />
          <SeoScore score={34} hint="No description yet" />
          <SeoScore score={75} hideWord />
        </div>
      </Section>

      <Section title="Video thumbnails: 16:9, four looks that rotate">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["Add your first product", "Ship with Shiprocket", "Sell on Instagram", "Read your analytics"].map((title, index) => (
            <VideoThumb key={title} title={title} duration={`${index + 2}:1${index}`} look={videoLookAt(index)} />
          ))}
        </div>
      </Section>

      <Section title="Wallet capsule: green 7+ days, orange 3–7 days, red under ₹2,000">
        <div className="flex flex-wrap items-center gap-4">
          <WalletCapsule balance={9800} dailySpend={690} onAddMoney={() => undefined} />
          <WalletCapsule balance={4820} dailySpend={690} onAddMoney={() => undefined} />
          <WalletCapsule balance={1450} dailySpend={690} onAddMoney={() => undefined} />
        </div>
      </Section>
    </div>
  );
}
