import { addToast, type Selection } from "@heroui/react";
import { toastError } from "../ui";
import { useMemo, useState } from "react";
import type { Coupon, PlanName } from "../../types";
import { getPlanLabel, PLAN_NAMES } from "../../lib/display-labels.util";
import { selectionToIdSet } from "../../lib/tableSelection";
import { formatDate } from "../../lib/utils";
import { joinParam, splitParam } from "../../lib/store-table.util";
import { useUrlSearch } from "../../hooks/use-url-search";
import { AppliedFilters } from "../common/AppliedFilters";
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
  DataTable,
  TablePagination,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import type { Tone } from "../ui";
import { IconTag } from "../ui/icons";
import { emptyStates } from "../../copy";

export interface CouponsTabProps {
  coupons: Coupon[];
  /** Resolves true when the server created the code; the dialog stays open otherwise. */
  onCreate: (coupon: Coupon) => Promise<boolean>;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /** Hides the empty-state "Create discount" for roles without coupons:manage. */
  canCreate?: boolean;
}

const columns = [
  { key: "code", label: "Code" },
  { key: "discount", label: "Discount" },
  { key: "appliesTo", label: "Applies to" },
  { key: "redemptions", label: "Used" },
  { key: "expiresAt", label: "Expires" },
  { key: "active", label: "Status" },
] as const;

const tableColumns: DataTableColumn[] = columns.map((column) => ({
  ...column,
  align: column.key === "redemptions" ? "end" : undefined,
}));

const statusOptions = [
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "expired", label: "Expired" },
];

const planOptions: Array<PlanName | "All"> = ["All", ...PLAN_NAMES];

type CouponStatus = "active" | "inactive" | "expired";

const statusDisplay: Record<CouponStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

/** Default "Expires on": 31 December of the current year. */
function defaultExpiry(): string {
  return `${new Date().getFullYear()}-12-31`;
}

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
  canCreate = true,
}: CouponsTabProps) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState<PlanName | "All">("All");
  const [maxRedemptions, setMaxRedemptions] = useState("100");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [active, setActive] = useState(true);
  // Search, status filter and page live in the URL; Columns is remembered (docs/design/09 §3.1).
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const statusFilter = splitParam(table.filters.status);
  const statusKey = statusFilter.join();
  const [visibleColumns, setVisibleColumns] = usePersistentColumns(
    "discounts",
    columns.map((column) => column.key),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const query = table.search.trim().toLowerCase();
    const wanted = statusKey ? statusKey.split(",") : [];
    return coupons.filter((coupon) => {
      const matchesSearch =
        !query ||
        coupon.code.toLowerCase().includes(query) ||
        getPlanLabel(coupon.appliesTo).toLowerCase().includes(query);
      const couponState = couponStatus(coupon);
      const matchesStatus =
        wanted.length === 0 || wanted.includes(couponState);
      return matchesSearch && matchesStatus;
    });
  }, [coupons, table.search, statusKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / table.pageSize));
  const page = Math.min(table.page, pageCount);
  const pageRows = filtered.slice((page - 1) * table.pageSize, page * table.pageSize);
  const isFiltered = table.search.trim() !== "" || statusFilter.length > 0;
  const clearFilters = () => {
    setSearch("");
    table.clearFilters();
  };

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
    setExpiresAt(defaultExpiry());
    setActive(true);
  };

  const handleCreate = async () => {
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

    setCreating(true);
    const created = await onCreate({
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
    setCreating(false);
    if (!created) return;
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
      <DataTable
        aria-label="Discounts"
        columns={tableColumns}
        visibleColumns={visibleColumns}
        rows={pageRows}
        getRowKey={(coupon) => coupon.id}
        renderCell={renderCell}
        selectedKeys={selected}
        onSelectionChange={handleSelectionChange}
        stickyFirstColumn
        scrollClassName="max-h-[70vh]"
        bulkBar={<SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />}
        toolbar={
          <>
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search discounts"
              columns={columns.map((column) => ({ key: column.key, label: column.label }))}
              visibleColumns={Array.from(visibleColumns)}
              onVisibleColumnsChange={(keys) => setVisibleColumns(new Set(keys))}
              filterContent={
                <FilterCheckboxGroup
                  label="Status"
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(value) => table.setFilter("status", joinParam(value))}
                />
              }
            />
            <AppliedFilters
              items={statusFilter.map((status) => ({
                key: status,
                label: `Status: ${statusOptions.find((o) => o.key === status)?.label ?? status}`,
                onRemove: () => table.setFilter("status", joinParam(statusFilter.filter((s) => s !== status))),
              }))}
              onClearAll={clearFilters}
            />
          </>
        }
        footer={
          <TablePagination
            page={page}
            pageSize={table.pageSize}
            total={filtered.length}
            onPageChange={table.setPage}
            onPageSizeChange={table.setPageSize}
          />
        }
        emptyContent={
          isFiltered ? (
            <EmptyState
              icon={IconTag}
              title={table.search.trim() ? emptyStates.noResults(table.search.trim()).title : "No discounts match these filters"}
              description={emptyStates.noResults("").description}
              action={
                <UiButton variant="secondary" size="sm" onPress={clearFilters}>
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
                canCreate ? (
                  <UiButton variant="secondary" size="sm" onPress={() => onCreateOpenChange(true)}>
                    Create discount
                  </UiButton>
                ) : undefined
              }
            />
          )
        }
      />

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
                <UiButton variant="primary" isLoading={creating} onPress={() => void handleCreate()}>
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
