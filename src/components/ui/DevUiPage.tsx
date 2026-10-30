/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Hidden component showcase at /dev/ui (docs/design/README.md, Phase 2): every shared component in every
 * state, for visual QA. Not linked from navigation; renders only in development builds.
 */
import { useState, type ReactNode } from "react";
import {
  addToast,
  DropdownItem,
  DropdownSection,
  DropdownTrigger,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  SelectItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { PageHeader } from "../layout/PageHeader";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { CardWrapper } from "./CardWrapper";
import { Checkbox } from "./Checkbox";
import { Chip } from "./Chip";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dropdown, DropdownMenu } from "./Dropdown";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { IconButton } from "./IconButton";
import {
  IconAdd,
  IconCalendar,
  IconCaret,
  IconColumns,
  IconExport,
  IconFilters,
  IconImport,
  IconMore,
  IconOrders,
  IconTag,
} from "./icons";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { formatMoney } from "./money";
import { menuItemDangerClasses } from "./menu-styles";
import { BackLink, CopyableId, Kbd, SaveBar, SegmentedControl } from "./Primitives";
import { SearchInput } from "./SearchInput";
import { Select } from "./Select";
import { Skeleton } from "./Skeleton";
import { KpiStrip, StatCard } from "./StatCard";
import { StatusChip } from "./StatusChip";
import { Switch } from "./Switch";
import { tableCellClasses, tableCheckboxClassNames, tableHeaderCellClasses, tablePanelClasses, tableRowClasses } from "./table-styles";
import { Tabs } from "./Tabs";
import { Textarea } from "./Textarea";
import { Tooltip } from "./Tooltip";
import { TONES } from "./tones";
import { toastError } from "./toast";
import { AiInsightCard, AiSuggestion, AiThinking, TodaysBrief, WriteWithAiButton } from "./Ai";
import { AskBar } from "../layout/Assistant";
import DevUiV14 from "./DevUiV14";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

const ROWS = [
  { id: "1", name: "Linen kurta set — Sage", sku: "NH-KS-014", status: "active", stock: "24 in stock", stockTone: "", price: 2450 },
  { id: "2", name: "Cotton co-ord — Indigo", sku: "NH-CO-007", status: "active", stock: "8 left", stockTone: "text-tone-warning", price: 3100 },
  { id: "3", name: "Mul-mul nightsuit", sku: "NH-MM-002", status: "active", stock: "Out of stock", stockTone: "text-tone-danger-text", price: 1650 },
  { id: "4", name: "Chanderi kurta — Ivory", sku: "NH-KU-031", status: "draft", stock: "—", stockTone: "text-fg-subtle", price: 2890 },
];

export default function DevUiPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [segment, setSegment] = useState<"revenue" | "orders">("revenue");
  const [search, setSearch] = useState("");

  if (!import.meta.env.DEV) return null;

  return (
    <div className="mx-auto max-w-content pb-24">
      <PageHeader
        title="Components"
        count={42}
        description="Every shared component in every state (docs/design/02-components.md). Hidden route."
        actions={
          <>
            <Button variant="secondary" startIcon={<IconImport />}>Import</Button>
            <Button variant="secondary" startIcon={<IconExport />}>Export</Button>
            <Button startIcon={<IconAdd />}>Add product</Button>
          </>
        }
      />

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="secondary">Ghost</Button>
        <Button variant="destructive-secondary">Delete</Button>
        <Button variant="destructive">Delete store</Button>
        <Button variant="tertiary">View all</Button>
        <Button variant="secondary" startIcon={<IconCalendar />} endIcon={<IconCaret />}>Last 30 days</Button>
        <Button isLoading>Saving</Button>
        <Button isDisabled>Disabled</Button>
      </Section>
      <Section title="Button sizes">
        <Button size="sm">Small 32</Button>
        <Button size="md">Default 36</Button>
        <Button size="lg">Large 40</Button>
        <Button variant="secondary" size="sm">Previous</Button>
        <IconButton aria-label="More actions" size="sm"><IconMore /></IconButton>
        <IconButton aria-label="Columns" variant="default"><IconColumns /></IconButton>
      </Section>

      <Section title="Badges (one tone map: statusTone)">
        {TONES.map((tone) => (
          <Chip key={tone} tone={tone}>{tone === "danger" ? "Critical" : tone.charAt(0).toUpperCase() + tone.slice(1)}</Chip>
        ))}
        <StatusChip domain="payment" status="paid" />
        <StatusChip domain="payment" status="pending" />
        <StatusChip domain="store" status="building" />
        <StatusChip domain="store" status="suspended" />
        <StatusChip domain="order" status="rto" />
        <StatusChip domain="product" status="draft" />
        <span className="inline-flex items-center gap-2 rounded-lg bg-nav px-3 py-1.5 text-label text-nav-fg">
          Notifications <Badge count={3} />
        </span>
      </Section>

      <Section title="Form controls">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Input label="Store name" placeholder="Nahara" description="Shown on invoices and emails." />
          <Input label="Email" defaultValue="owner@nahara" isInvalid errorMessage="Enter a valid email address." />
          <Select label="Category" placeholder="Choose a category">
            <SelectItem key="kurtas">Kurtas</SelectItem>
            <SelectItem key="sarees">Sarees</SelectItem>
          </Select>
          <Input label="SKU (optional)" isDisabled defaultValue="NH-KS-014" />
          <Textarea label="Description" placeholder="Linen kurta set in sage." />
          <div className="flex flex-col gap-3">
            <SearchInput placeholder="Search products" value={search} onValueChange={setSearch} />
            <Checkbox defaultSelected>Track inventory</Checkbox>
            <Switch defaultSelected>Prices include tax</Switch>
          </div>
        </div>
      </Section>

      <Section title="Tabs and segmented control">
        <Tabs aria-label="Status">
          <Tab key="all" title="All" />
          <Tab key="active" title="Active" />
          <Tab key="draft" title="Draft" />
          <Tab key="archived" title="Archived" />
        </Tabs>
        <SegmentedControl
          aria-label="Chart metric"
          value={segment}
          onChange={setSegment}
          options={[{ value: "revenue", label: "Revenue" }, { value: "orders", label: "Orders" }]}
        />
      </Section>

      <Section title="KPI strip">
        <KpiStrip className="w-full">
          <StatCard bare label="Revenue" value={482650} format="money" delta={17} deltaLabel="vs previous 30 days" />
          <StatCard bare label="Orders" value={1284} delta={14} deltaLabel="vs previous 30 days" />
          <StatCard bare label="Conversion rate" value={2.4} format="percent" delta={-0.3} deltaUnit="pts" deltaLabel="vs previous 30 days" />
          <StatCard bare label="Outstanding" value={70000} format="money" valueTone="danger" deltaLabel="4 stores unpaid · 2 overdue" />
        </KpiStrip>
        <StatCard label="Loading" value={0} isLoading className="w-60" />
        <StatCard label="Error" value={0} isError className="w-60" />
      </Section>

      <Section title="Table card">
        <div className={`${tablePanelClasses} w-full`}>
          <div className="flex min-h-[52px] flex-col gap-2 border-b border-line px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:py-0">
            <Tabs aria-label="Product status" classNames={{ tabList: "border-0", tab: "h-[52px]" }}>
              <Tab key="all" title="All" />
              <Tab key="active" title="Active" />
              <Tab key="draft" title="Draft" />
            </Tabs>
            <div className="flex items-center gap-1">
              <SearchInput placeholder="Search products" className="mr-1 w-64" />
              <Button variant="secondary" size="sm" startIcon={<IconFilters />}>Filter</Button>
              <Button variant="secondary" size="sm" startIcon={<IconColumns />}>Columns</Button>
            </div>
          </div>
          <Table
            aria-label="Products"
            removeWrapper
            selectionMode="multiple"
            checkboxesProps={{ classNames: tableCheckboxClassNames }}
            classNames={{ th: tableHeaderCellClasses, td: tableCellClasses, tr: tableRowClasses }}
          >
            <TableHeader>
              <TableColumn>Product</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Inventory</TableColumn>
              <TableColumn align="end">Price</TableColumn>
              <TableColumn align="end"> </TableColumn>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="size-9 shrink-0 rounded-lg bg-surface-sunken" />
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-caption text-fg-subtle">{row.sku}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusChip domain="product" status={row.status} /></TableCell>
                  <TableCell><span className={row.stockTone}>{row.stock}</span></TableCell>
                  <TableCell className="text-right num">{formatMoney(row.price)}</TableCell>
                  <TableCell className="text-right">
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <IconButton aria-label="Actions" size="sm"><IconMore /></IconButton>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Row actions">
                        <DropdownSection showDivider>
                          <DropdownItem key="edit">Edit</DropdownItem>
                          <DropdownItem key="duplicate">Duplicate</DropdownItem>
                        </DropdownSection>
                        <DropdownSection>
                          <DropdownItem key="delete" className={menuItemDangerClasses}>Delete</DropdownItem>
                        </DropdownSection>
                      </DropdownMenu>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-label text-fg-muted">
            <span className="num">1–4 of 248</span>
            <span className="flex gap-2">
              <Button variant="secondary" size="sm">Previous</Button>
              <Button variant="secondary" size="sm">Next</Button>
            </span>
          </div>
        </div>
      </Section>

      <Section title="Cards">
        <Card title="Needs attention" actions={<Button variant="tertiary" size="sm">View all</Button>} className="w-80">
          <p className="text-body text-fg-muted">Card body, 20px padding. No shadow, no icon tiles.</p>
        </Card>
        <CardWrapper title="Revenue" description="Legacy CardWrapper" className="w-80">
          <Skeleton className="h-24 w-full" />
        </CardWrapper>
      </Section>

      <Section title="Empty, error and loading states">
        <Card className="w-80" padding="none"><EmptyState icon={IconOrders} title="No orders yet" description="When customers buy from your store, their orders show up here." action={<Button variant="secondary">Share your store link</Button>} /></Card>
        <Card className="w-80" padding="none"><EmptyState icon={IconTag} compact description="No sales in this period." /></Card>
        <Card className="w-80" padding="none"><ErrorState title="Couldn't load products." onRetry={() => undefined} /></Card>
        <Card className="w-80" padding="none"><ErrorState inline title="Couldn't load products." onRetry={() => undefined} /></Card>
        <div className="flex w-80 flex-col gap-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></div>
      </Section>

      <DevUiV14 />

      <Section title="AI layer">
        <TodaysBrief
          className="w-full"
          message="Sessions are up 17% this month, but conversion slipped to 2.4%."
          action={{ label: "Review products", onPress: () => undefined }}
          onDismiss={() => undefined}
        />
        <AiThinking
          className="w-80"
          status="Analysing the last 30 days…"
          steps={[
            { label: "Read 1,284 orders", done: true },
            { label: "Compared traffic sources", done: true },
            { label: "Checking checkout drop-offs", done: false },
          ]}
        />
        <AiInsightCard
          className="w-80"
          title="Mobile checkout is losing buyers"
          body="68% of abandoned carts this month were on mobile, mostly at the shipping step."
          action={{ label: "Show cost on product page", onPress: () => undefined }}
          onDismiss={() => undefined}
          source="Based on orders and sessions, 15 Sep – 14 Oct"
        />
        <div className="flex w-full max-w-2xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-label font-medium text-fg">Description</span>
            <WriteWithAiButton onPress={() => undefined} />
          </div>
          <AiSuggestion
            subtitle="a more premium version of your description"
            text="A breathable kurta set cut from pure linen in a soft sage green."
            onUse={() => undefined}
            onKeep={() => undefined}
            onAsk={() => undefined}
          />
          <AiSuggestion isLoading onUse={() => undefined} onKeep={() => undefined} onAsk={() => undefined} />
          <AiSuggestion
            error="I couldn't reach the AI service. Try again."
            onRetry={() => undefined}
            onUse={() => undefined}
            onKeep={() => undefined}
          />
          <TodaysBrief
            lines={[
              { what: "Pack 12 orders before 4 pm", why: "that's when Delhivery picks up" },
              { what: "Restock the linen kurta", why: "3 left and it sold 9 this week" },
              { what: "Plan something for Saturday", why: "your best day, with nothing scheduled" },
            ]}
            actions={[
              { label: "Ship orders", onPress: () => undefined },
              { label: "Restock", onPress: () => undefined },
              { label: "Plan a campaign", onPress: () => undefined },
            ]}
            onAskAi={() => undefined}
          />
        </div>
        <div className="w-full max-w-[560px]">
          <AskBar placeholder="Ask anything about your store…" hidden={false} onOpen={() => undefined} />
        </div>
      </Section>

      <Section title="Overlays and feedback">
        <Tooltip content="Tooltip text"><Button variant="secondary">Hover for tooltip</Button></Tooltip>
        <Button variant="secondary" onPress={() => setModalOpen(true)}>Open modal</Button>
        <Button variant="destructive-secondary" onPress={() => setConfirmOpen(true)}>Delete store</Button>
        <Button variant="secondary" onPress={() => addToast({ title: "Product saved." })}>Toast</Button>
        <Button variant="secondary" onPress={() => toastError("Couldn't save the product.", { description: "Check your connection and try again." })}>Error toast</Button>
      </Section>

      <Section title="IDs, shortcuts, navigation">
        <CopyableId value="1042">#1042</CopyableId>
        <CopyableId value="LAUNCH25" />
        <Kbd>⌘K</Kbd>
        <BackLink to="/">Products</BackLink>
        <Button variant="secondary" onPress={() => setDirty(true)}>Make the form dirty</Button>
      </Section>

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen} width="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Add tag</ModalHeader>
              <ModalBody><Input label="Tag name" placeholder="Summer sale" /></ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={close}>Cancel</Button>
                <Button onPress={close}>Add tag</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Delete Aura Apparel?"
        description="The store and all its data are removed. This can't be undone."
        confirmLabel="Delete store"
      />
      <SaveBar isVisible={dirty} onDiscard={() => setDirty(false)} onSave={() => setDirty(false)} />
    </div>
  );
}
