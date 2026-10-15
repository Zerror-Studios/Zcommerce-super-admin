import { addToast, Card, CardBody, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type Selection } from "@heroui/react";
import { useMemo, useState } from "react";
import type { Client, Subscription } from "../../types";
import { subscriptions } from "../../lib/mockData";
import { selectionToIdSet } from "../../lib/tableSelection";
import { daysUntil, formatDate } from "../../lib/utils";
import { useClients } from "../../providers/ClientsProvider";
import { dataTableClassNames, dataTableSelectionProps, tablePanelClassName } from "../common/dataTableStyles";
import { dashboardModalProps } from "../common/modalStyles";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import { StatusChip } from "../common/StatusChip";
import { TableToolbar } from "../common/TableToolbar";
import { IconMessages, IconSend, IconView } from "../ui/icons";
import { Button as UiButton } from "../ui";

type WindowFilter = "all" | "30" | "14" | "7" | "3" | "overdue";

interface StoreRow {
  id: string;
  client: Client;
  subscription: Subscription;
  daysLeft: number;
}

const columns = [
  { key: "storeName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "renewalDate", label: "Renewal / Due" },
  { key: "daysLeft", label: "Days left" },
  { key: "status", label: "Status" },
] as const;

const EMAIL_SUBJECT =
  "Your Zcommerce subscription renews in {{days}} days";
const EMAIL_BODY =
  "Hi {{ownerName}},\n\nYour store {{storeName}} on the {{plan}} plan renews on {{renewalDate}} (in {{days}} days).\n\nPlease ensure your payment method is up to date to avoid service interruption.\n\n— Zcommerce";

export function AutomationSettingsTab() {
  const { clients } = useClients();
  const [search, setSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("30");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);

  const subscriptionByClientId = useMemo(() => {
    const map = new Map<string, Subscription>();
    subscriptions.forEach((sub) => map.set(sub.clientId, sub));
    return map;
  }, []);

  const allStoreRows = useMemo(() => {
    const rows: StoreRow[] = [];
    clients.forEach((client) => {
      const subscription = subscriptionByClientId.get(client.id);
      if (!subscription || subscription.status === "canceled") return;
      rows.push({
        id: client.id,
        client,
        subscription,
        daysLeft: daysUntil(subscription.renewalDate),
      });
    });
    return rows.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [clients, subscriptionByClientId]);

  const storeRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allStoreRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.client.storeName.toLowerCase().includes(query) ||
        row.client.ownerEmail.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      switch (windowFilter) {
        case "all":
          return true;
        case "overdue":
          return row.daysLeft < 0 || row.subscription.status === "past_due";
        default: {
          const max = Number(windowFilter);
          return row.daysLeft >= 0 && row.daysLeft <= max;
        }
      }
    });
  }, [allStoreRows, search, windowFilter]);

  const selectedCount = selected.size;

  const counts = useMemo(
    () => ({
      within30: allStoreRows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 30)
        .length,
      within7: allStoreRows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7)
        .length,
      overdue: allStoreRows.filter((r) => r.daysLeft < 0).length,
      selected: selectedCount,
    }),
    [allStoreRows, selectedCount],
  );

  const handleSelectionChange = (keys: Selection) => {
    setSelected(selectionToIdSet(keys, storeRows.map((row) => row.id)));
  };

  const handleSend = () => {
    if (selectedCount === 0) {
      addToast({
        title: "No stores selected",
        description: "Select one or more stores to send emails.",
        color: "danger",
      });
      return;
    }

    addToast({
      title: "Emails queued",
      description: `Reminder email will be sent to ${selectedCount} store${selectedCount === 1 ? "" : "s"} (demo).`,
      color: "success",
    });
    setSelected(new Set());
    setPreviewOpen(false);
  };

  const renderCell = (row: StoreRow, key: string) => {
    const { client, subscription, daysLeft } = row;

    switch (key) {
      case "storeName":
        return (
          <div>
            <p className="font-medium text-foreground">{client.storeName}</p>
            <p className="text-caption text-default-400">{client.ownerEmail}</p>
          </div>
        );
      case "plan":
        return <StatusChip kind="plan" value={client.plan} />;
      case "renewalDate":
        return (
          <span className="text-body text-default-600">
            {formatDate(subscription.renewalDate)}
          </span>
        );
      case "daysLeft": {
        const label =
          daysLeft < 0
            ? `Overdue ${Math.abs(daysLeft)}d`
            : daysLeft === 0
              ? "Due today"
              : `${daysLeft}d`;
        const tone =
          daysLeft < 0
            ? "text-danger"
            : daysLeft <= 7
              ? "text-warning"
              : "text-default-700";
        return <span className={`text-body font-medium ${tone}`}>{label}</span>;
      }
      case "status":
        return <StatusChip kind="subscription" value={subscription.status} />;
      default:
        return "—";
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card shadow="none" className="border border-line bg-surface">
          <CardBody className="gap-1 p-4">
            <p className="text-caption text-default-500">Expiring in 30 days</p>
            <p className="text-title font-bold">{counts.within30}</p>
          </CardBody>
        </Card>
        <Card shadow="none" className="border border-line bg-surface">
          <CardBody className="gap-1 p-4">
            <p className="text-caption text-default-500">Expiring in 7 days</p>
            <p className="text-title font-bold">{counts.within7}</p>
          </CardBody>
        </Card>
        <Card shadow="none" className="border border-line bg-surface">
          <CardBody className="gap-1 p-4">
            <p className="text-caption text-default-500">Overdue</p>
            <p className="text-title font-bold text-danger">{counts.overdue}</p>
          </CardBody>
        </Card>
        <Card shadow="none" className="border border-line bg-surface">
          <CardBody className="gap-1 p-4">
            <p className="text-caption text-default-500">Selected stores</p>
            <p className="text-title font-bold text-primary">{counts.selected}</p>
          </CardBody>
        </Card>
      </div>

      <Card shadow="none" className={tablePanelClassName}>
        <CardBody className="gap-0 p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search stores by name or email..."
            endContent={
              <Select
                aria-label="Expiry window"
                size="sm"
                radius="full"
                className="w-44"
                selectedKeys={new Set([windowFilter])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (
                    value === "all" ||
                    value === "30" ||
                    value === "14" ||
                    value === "7" ||
                    value === "3" ||
                    value === "overdue"
                  ) {
                    setWindowFilter(value);
                    setSelected(new Set());
                  }
                }}
                disallowEmptySelection
              >
                <SelectItem key="30">Within 30 days</SelectItem>
                <SelectItem key="14">Within 14 days</SelectItem>
                <SelectItem key="7">Within 7 days</SelectItem>
                <SelectItem key="3">Within 3 days</SelectItem>
                <SelectItem key="overdue">Overdue</SelectItem>
                <SelectItem key="all">All stores</SelectItem>
              </Select>
            }
          />

          <Table
            aria-label="Stores for expiry emails"
            {...dataTableSelectionProps}
            selectedKeys={selected}
            onSelectionChange={handleSelectionChange}
            classNames={dataTableClassNames}
          >
            <TableHeader columns={[...columns]}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={storeRows}
              emptyContent={
                <NoDataPlaceholder
                  title="No stores in this window"
                  description="Try a wider expiry filter or search another store."
                  iconHeight={90}
                />
              }
            >
              {(row) => (
                <TableRow key={row.id}>
                  {(columnKey) => (
                    <TableCell>{renderCell(row, String(columnKey))}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card shadow="none" className="border border-line bg-surface">
        <CardBody className="flex flex-row flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconMessages size={18} strokeWidth={2.25} />
            </div>
            <div>
              <h3 className="text-subtitle font-bold">Ready to send</h3>
              <p className="text-caption text-default-500">
                {selectedCount > 0
                  ? `${selectedCount} store${selectedCount === 1 ? "" : "s"} selected for expiry reminder emails`
                  : "Select one or more stores to send expiry reminder emails"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <UiButton
              variant="outline"
              size="sm"
              startIcon={<IconView size={14} strokeWidth={2.5} />}
              onPress={() => setPreviewOpen(true)}
            >
              Preview email
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              startIcon={<IconSend size={14} strokeWidth={2.5} />}
              isDisabled={selectedCount === 0}
              onPress={handleSend}
            >
              Send emails
            </UiButton>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        size="lg"
        {...dashboardModalProps}
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>
                Email preview
                <span className="mt-1 text-body font-normal text-default-500">
                  Same template for all selected stores — placeholders are filled
                  when sending
                </span>
              </ModalHeader>
              <ModalBody>
                <div>
                  <p className="text-body font-medium text-foreground">Subject</p>
                  <p className="mt-1 rounded-md border border-line bg-surface-muted px-3 py-2 text-body">
                    {EMAIL_SUBJECT}
                  </p>
                </div>
                <div>
                  <p className="text-body font-medium text-foreground">Message</p>
                  <div className="mt-1 rounded-md border border-line bg-surface-muted px-4 py-3">
                    <p className="whitespace-pre-wrap text-body text-default-700">
                      {EMAIL_BODY}
                    </p>
                  </div>
                </div>
                <p className="text-caption text-default-500">
                  Placeholders: {"{{days}}"}, {"{{storeName}}"}, {"{{ownerName}}"}
                  , {"{{plan}}"}, {"{{renewalDate}}"}
                </p>
              </ModalBody>
              <ModalFooter>
                <UiButton variant="danger-outline" size="sm" onPress={close}>
                  Cancel
                </UiButton>
                <UiButton
                  variant="primary"
                  size="sm"
                  isDisabled={selectedCount === 0}
                  onPress={handleSend}
                >
                  Send emails
                </UiButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
