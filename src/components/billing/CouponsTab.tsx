import { addToast, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type Selection } from "@heroui/react";
import { toastError } from "../ui";
import { useMemo, useState } from "react";
import type { Coupon, PlanName } from "../../types";
import { getPlanLabel, PLAN_NAMES } from "../../lib/display-labels.util";
import { selectionToIdSet } from "../../lib/tableSelection";
import { formatDate } from "../../lib/utils";
import { dataTableFillClassNames, dataTableSelectionProps, tablePanelFillClassName } from "../common/dataTableStyles";
import {
  FilterCheckboxGroup,
  TableToolbar,
} from "../common/TableToolbar";
import {
  Button as UiButton,
  Chip,
  CopyableId,
  EmptyState,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  SelectionBar,
  Switch,
  formatCount,
  formatMoney,
  tableRowClasses,
} from "../ui";
import type { Tone } from "../ui";
import { IconTag } from "../ui/icons";
import { emptyStates } from "../../copy";

export interface CouponsTabProps {
  coupons: Coupon[];
  onCreate: (coupon: Coupon) => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

const columns = [
  { key: "code", label: "Code" },
  { key: "discount", label: "Discount" },
  { key: "appliesTo", label: "Applies to" },
  { key: "redemptions", label: "Used" },
  { key: "expiresAt", label: "Expires" },
  { key: "active", label: "Status" },
] as const;

const planOptions: Array<PlanName | "All"> = ["All", ...PLAN_NAMES];

type CouponStatus = "active" | "inactive" | "expired";

const statusDisplay: Record<CouponStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

/**
 * Display status (docs/design/04-super-admin.md §3.8): a code past its expiry date shows "Expired" even if it
 * is still flagged active. Derived at render time; the stored coupon is not changed.
 */
function couponStatus(coupon: Coupon, now: Date = new Date()): CouponStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expires = new Date(coupon.expiresAt);
  const expiresDay = new Date(expires.getFullYear(), expires.getMonth(), expires.getDate()).getTime();
  if (!Number.isNaN(expiresDay) && expiresDay < today) return "expired";
  return coupon.active ? "active" : "inactive";
}

export function CouponsTab({
  coupons,
  onCreate,
  createOpen,
  onCreateOpenChange,
}: CouponsTabProps) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState<PlanName | "All">("All");
  const [maxRedemptions, setMaxRedemptions] = useState("100");
  const [expiresAt, setExpiresAt] = useState("2026-12-31");
  const [active, setActive] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map((column) => column.key),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return coupons.filter((coupon) => {
      const matchesSearch =
        !query ||
        coupon.code.toLowerCase().includes(query) ||
        getPlanLabel(coupon.appliesTo).toLowerCase().includes(query);
      const statusKey = couponStatus(coupon);
      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(statusKey);
      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const dataColumns = columns.filter((column) =>
    visibleColumns.includes(column.key),
  );
  const headerColumns = dataColumns;
  const isFiltered = search.trim() !== "" || statusFilter.length > 0;

  const handleSelectionChange = (keys: Selection) => {
    setSelected(selectionToIdSet(keys, filtered.map((item) => item.id)));
  };

  const renderCell = (coupon: Coupon, key: string) => {
    switch (key) {
      case "code":
        return <CopyableId value={coupon.code} />;
      case "discount":
        return coupon.discountType === "percent"
          ? `${coupon.discountValue}%`
          : formatMoney(coupon.discountValue);
      case "appliesTo":
        return coupon.appliesTo === "All" ? "All plans" : getPlanLabel(coupon.appliesTo);
      case "redemptions":
        return (
          <span className="block text-right num">
            {formatCount(coupon.redemptions)} / {formatCount(coupon.maxRedemptions)}
          </span>
        );
      case "expiresAt":
        return <span className="num">{formatDate(coupon.expiresAt)}</span>;
      case "active": {
        const status = statusDisplay[couponStatus(coupon)];
        return <Chip tone={status.tone}>{status.label}</Chip>;
      }
      default:
        return <span className="text-fg-subtle">—</span>;
    }
  };

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setDiscountValue("10");
    setAppliesTo("All");
    setMaxRedemptions("100");
    setExpiresAt("2026-12-31");
    setActive(true);
  };

  const handleCreate = () => {
    const trimmed = code.trim().toUpperCase();
    const value = Number(discountValue);
    const max = Number(maxRedemptions);
    if (!trimmed) {
      toastError("Enter a code.");
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      toastError("Enter a discount above 0.");
      return;
    }
    if (Number.isNaN(max) || max <= 0) {
      toastError("Enter a usage limit above 0.");
      return;
    }

    onCreate({
      id: `cpn-${Date.now()}`,
      code: trimmed,
      discountType,
      discountValue: value,
      appliesTo,
      redemptions: 0,
      maxRedemptions: max,
      expiresAt,
      active,
    });
    onCreateOpenChange(false);
    resetForm();
    addToast({
      title: `${trimmed} created.`,
      description: "The code is ready to use.",
      color: "success",
    });
  };

  return (
    <>
      <div className={tablePanelFillClassName}>
        {selected.size > 0 ? (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />
        ) : (
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search discounts"
            columns={[...columns].map((column) => ({
              key: column.key,
              label: column.label,
            }))}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={setVisibleColumns}
            filterContent={
              <FilterCheckboxGroup
                label="Status"
                options={[
                  { key: "active", label: "Active" },
                  { key: "inactive", label: "Inactive" },
                  { key: "expired", label: "Expired" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            }
          />
        )}
        <Table
          aria-label="Discounts"
          {...dataTableSelectionProps}
          selectedKeys={selected}
          onSelectionChange={handleSelectionChange}
          classNames={{ ...dataTableFillClassNames, tr: tableRowClasses }}
        >
          <TableHeader columns={headerColumns}>
            {(column) => (
              <TableColumn key={column.key} align={column.key === "redemptions" ? "end" : "start"}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={filtered}
            emptyContent={
              isFiltered ? (
                <EmptyState
                  icon={IconTag}
                  title={search.trim() ? emptyStates.noResults(search.trim()).title : "No discounts match these filters"}
                  description={emptyStates.noResults("").description}
                  action={
                    <UiButton
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setSearch("");
                        setStatusFilter([]);
                      }}
                    >
                      {emptyStates.noResults("").action}
                    </UiButton>
                  }
                />
              ) : (
                <EmptyState
                  icon={IconTag}
                  title="No discounts yet"
                  description="Create a code to give stores a discount on their plan."
                  action={
                    <UiButton variant="secondary" size="sm" onPress={() => onCreateOpenChange(true)}>
                      Create discount
                    </UiButton>
                  }
                />
              )
            }
          >
            {(coupon) => (
              <TableRow key={coupon.id}>
                {(columnKey) => (
                  <TableCell>{renderCell(coupon, String(columnKey))}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          onCreateOpenChange(false);
          resetForm();
        }}
        width="md"
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Create discount</ModalHeader>
              <ModalBody className="gap-4">
                <Input
                  label="Code"
                  placeholder="SAVE20"
                  value={code}
                  onValueChange={setCode}
                  classNames={{ input: "font-mono" }}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Discount type"
                    selectedKeys={new Set([discountType])}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      if (value === "percent" || value === "fixed") setDiscountType(value);
                    }}
                    disallowEmptySelection
                  >
                    <SelectItem key="percent">Percentage</SelectItem>
                    <SelectItem key="fixed">Fixed amount (₹)</SelectItem>
                  </Select>
                  <Input
                    label="Discount value"
                    placeholder="0"
                    type="number"
                    value={discountValue}
                    onValueChange={setDiscountValue}
                  />
                </div>
                <Select
                  label="Applies to"
                  selectedKeys={new Set([appliesTo])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (typeof value === "string") setAppliesTo(value as PlanName | "All");
                  }}
                  disallowEmptySelection
                >
                  {planOptions.map((option) => (
                    <SelectItem key={option}>{option === "All" ? "All plans" : getPlanLabel(option)}</SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Usage limit"
                    placeholder="100"
                    type="number"
                    value={maxRedemptions}
                    onValueChange={setMaxRedemptions}
                  />
                  <Input
                    label="Expires on"
                    type="date"
                    value={expiresAt}
                    onValueChange={setExpiresAt}
                  />
                </div>
                <Switch isSelected={active} onValueChange={setActive}>
                  Active right away
                </Switch>
              </ModalBody>
              <ModalFooter>
                <UiButton variant="ghost" onPress={close}>
                  Cancel
                </UiButton>
                <UiButton variant="primary" onPress={handleCreate}>
                  Create discount
                </UiButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
