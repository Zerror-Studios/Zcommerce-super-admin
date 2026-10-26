import { useQuery } from "@apollo/client";
import { addToast, type Selection } from "@heroui/react";
import { toastError } from "../ui";
import { useCallback, useMemo, useState, type Key, type ReactNode } from "react";
import type { Coupon, PlanName } from "../../types";
import { PLATFORM_PLANS } from "../../graphql/plans";
import type { PlatformPlan } from "../../types/platform-api";
import {
  couponErrorsFromServer,
  couponPlanOptions,
  couponScopeLabel,
  couponToDraft,
  emptyCouponDraft,
  validateCouponDraft,
  type CouponDraft,
  type CouponFormErrors,
  type CouponWrite,
} from "../../lib/coupon-form.util";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { ConfirmModal } from "../common/ConfirmModal";
import { getPlanLabel, PLAN_NAMES } from "../../lib/display-labels.util";
import { selectionToIdSet } from "../../lib/tableSelection";
import { formatDate } from "../../lib/utils";
import { joinParam, splitParam } from "../../lib/store-table.util";
import { useUrlSearch } from "../../hooks/use-url-search";
import { AppliedFilters } from "../common/AppliedFilters";
import { FilterEmpty } from "../common/FilterEmpty";
import {
  FilterCheckboxGroup,
  TableToolbar,
} from "../common/TableToolbar";
import {
  Button as UiButton,
  Chip,
  CopyableId,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  EmptyState,
  IconButton,
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
  menuItemDangerClasses,
  DataTable,
  TablePagination,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import type { Tone } from "../ui";
import { IconMore, IconTag } from "../ui/icons";

export interface CouponsTabProps {
  coupons: Coupon[];
  /** Resolves once the server has saved the code; rejects with the API error (UX-24). */
  onCreate: (coupon: CouponWrite) => Promise<void>;
  /** Saves changed fields (PLT-13); rejects with the API error. */
  onUpdate?: (id: string, patch: Partial<Coupon>) => Promise<void>;
  /** Stops a code from being applied (PLT-13); rejects with the API error. */
  onDeactivate?: (id: string) => Promise<void>;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /** Hides "Create discount" and the row actions for roles without coupons:manage. */
  canCreate?: boolean;
  /** Under the table, e.g. "Load more" while the API has more pages. */
  footer?: ReactNode;
}

const columns = [
  { key: "code", label: "Code" },
  { key: "discount", label: "Discount" },
  { key: "appliesTo", label: "Applies to" },
  { key: "redemptions", label: "Used" },
  { key: "expiresAt", label: "Expires" },
  { key: "active", label: "Status" },
  { key: "actions", label: "" },
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
  onUpdate,
  onDeactivate,
  createOpen,
  onCreateOpenChange,
  canCreate = true,
  footer,
}: CouponsTabProps) {
  const [draft, setDraft] = useState<CouponDraft>(() => emptyCouponDraft());
  const [formErrors, setFormErrors] = useState<CouponFormErrors>({});
  const [saving, setSaving] = useState(false);
  // The coupon being edited; null while creating (PLT-13).
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Coupon | null>(null);
  // Search, status filter and page live in the URL; Columns is remembered (docs/design/09 §3.1).
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const statusFilter = splitParam(table.filters.status);
  const [visibleColumns, setVisibleColumns] = usePersistentColumns(
    "discounts",
    columns.map((column) => column.key),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // PRD-017 FR-4.4: every plan version and custom plan, for the picker and
  // the "Applies to" column of coupons limited by plan id.
  const plansQuery = useQuery<{ platformPlans: PlatformPlan[] }>(PLATFORM_PLANS, {
    variables: { includeInactive: true },
  });
  const allPlans = useMemo(() => plansQuery.data?.platformPlans ?? [], [plansQuery.data]);
  const planOptionsById = useMemo(() => couponPlanOptions(allPlans), [allPlans]);
  const scopeOf = useCallback(
    (coupon: Coupon) => couponScopeLabel(coupon, allPlans, getPlanLabel),
    [allPlans],
  );

  // PRD-024 FR-3.5 (B-07): search (code or plan) and status run on the server
  // over every coupon (Settings passes them to `platformCoupons`); the rows
  // arrive filtered.
  const filtered = coupons;

  // Row actions only for roles with coupons:manage and a save handler.
  const shownColumns = useMemo(() => {
    const shown = new Set(visibleColumns);
    if (!(canCreate && onUpdate)) shown.delete("actions");
    return shown;
  }, [visibleColumns, canCreate, onUpdate]);
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
        return scopeOf(coupon);
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
      case "actions":
        return (
          <div className="flex justify-end">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <IconButton aria-label={`Actions for ${coupon.code}`} showTooltip={false} size="sm">
                  <IconMore aria-hidden className="size-4" />
                </IconButton>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Discount actions"
                onAction={(key) => onRowAction(coupon, key)}
                disabledKeys={coupon.active ? ["activate"] : ["deactivate"]}
              >
                <DropdownItem key="edit">Edit</DropdownItem>
                <DropdownItem key="activate">Activate</DropdownItem>
                <DropdownItem key="deactivate" className={menuItemDangerClasses}>Deactivate</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      default:
        return <span className="text-fg-subtle">—</span>;
    }
  };

  const setField = <K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const closeForm = () => {
    if (saving) return;
    onCreateOpenChange(false);
    setEditing(null);
    setDraft(emptyCouponDraft());
    setFormErrors({});
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setDraft(couponToDraft(coupon));
    setFormErrors({});
    onCreateOpenChange(true);
  };

  /** A failed save keeps the modal and what was typed (UX-24). */
  const showSaveError = (error: unknown) => {
    const fieldErrors = couponErrorsFromServer(error);
    if (fieldErrors) {
      setFormErrors(fieldErrors);
      return;
    }
    const message = mutationFailureCopy(error);
    if (message) toastError(message);
  };

  const handleSave = async () => {
    const result = validateCouponDraft(draft);
    if (!result.coupon) {
      setFormErrors(result.errors);
      return;
    }
    const coupon = result.coupon;
    setSaving(true);
    try {
      if (editing && onUpdate) {
        await onUpdate(editing.id, coupon);
        addToast({ title: `${coupon.code} saved.`, color: "success" });
      } else {
        await onCreate(coupon);
        addToast({
          title: `${coupon.code} created.`,
          description: "The code is ready to use.",
          color: "success",
        });
      }
      onCreateOpenChange(false);
      setEditing(null);
      setDraft(emptyCouponDraft());
      setFormErrors({});
    } catch (error) {
      showSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const onRowAction = (coupon: Coupon, key: Key) => {
    if (key === "edit") openEdit(coupon);
    else if (key === "deactivate") setDeactivateTarget(coupon);
    else if (key === "activate" && onUpdate) {
      onUpdate(coupon.id, { active: true })
        .then(() => addToast({ title: `${coupon.code} is active again.` }))
        .catch((error) => {
          const message = mutationFailureCopy(error);
          if (message) toastError(message);
        });
    }
  };

  const confirmDeactivate = () => {
    const target = deactivateTarget;
    if (!target || !onDeactivate) return;
    onDeactivate(target.id)
      .then(() => addToast({ title: `${target.code} deactivated.`, description: "It can't be applied to new invoices." }))
      .catch((error) => {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      });
  };

  return (
    <>
      <DataTable
        aria-label="Discounts"
        columns={tableColumns}
        visibleColumns={shownColumns}
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
              searchPlaceholder="Search by code or plan"
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
          <>
            <TablePagination
              page={page}
              pageSize={table.pageSize}
              total={filtered.length}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
            {footer}
          </>
        }
        emptyContent={
          isFiltered ? (
            <FilterEmpty things="discounts" query={table.search} onClear={clearFilters} />
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
        onClose={closeForm}
        width="md"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>{editing ? `Edit ${editing.code}` : "Create discount"}</ModalHeader>
              <ModalBody className="gap-4">
                {formErrors.form ? (
                  <p role="alert" className="text-label text-tone-danger-text">
                    {formErrors.form}
                  </p>
                ) : null}
                <Input
                  label="Code"
                  placeholder="SAVE20"
                  value={draft.code}
                  onValueChange={(value) => setField("code", value)}
                  isInvalid={!!formErrors.code}
                  errorMessage={formErrors.code}
                  classNames={{ input: "font-mono" }}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Discount type"
                    selectedKeys={new Set([draft.discountType])}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      if (value === "percent" || value === "fixed") setField("discountType", value);
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
                    value={draft.discountValue}
                    onValueChange={(value) => setField("discountValue", value)}
                    isInvalid={!!formErrors.discountValue}
                    errorMessage={formErrors.discountValue}
                  />
                </div>
                <Select
                  label="Applies to"
                  selectedKeys={new Set([draft.appliesTo])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (typeof value === "string") setField("appliesTo", value as PlanName | "All");
                  }}
                  disallowEmptySelection
                >
                  {planOptions.map((option) => (
                    <SelectItem key={option}>{option === "All" ? "All plans" : getPlanLabel(option)}</SelectItem>
                  ))}
                </Select>
                {/* PRD-017 FR-4.4: specific versions or custom plans win over the tier. */}
                <Select
                  label="Limit to specific plans"
                  placeholder="Any version of the tier above"
                  selectionMode="multiple"
                  selectedKeys={new Set(draft.appliesToPlanIds)}
                  onSelectionChange={(keys) => {
                    const ids = keys === "all" ? planOptionsById.map((option) => option.id) : Array.from(keys).map(String);
                    setField("appliesToPlanIds", ids);
                  }}
                  isLoading={plansQuery.loading && !plansQuery.data}
                  isInvalid={!!formErrors.appliesToPlanIds}
                  errorMessage={formErrors.appliesToPlanIds}
                  description={
                    plansQuery.error && !plansQuery.data
                      ? "Couldn't load the plans; the tier above applies."
                      : "Optional. When you pick plans, the code applies only to them, including custom plans and older versions."
                  }
                >
                  {planOptionsById.map((option) => (
                    <SelectItem key={option.id}>{option.label}</SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Usage limit"
                    placeholder="100"
                    type="number"
                    value={draft.maxRedemptions}
                    onValueChange={(value) => setField("maxRedemptions", value)}
                    isInvalid={!!formErrors.maxRedemptions}
                    errorMessage={formErrors.maxRedemptions}
                  />
                  <Input
                    label="Expires on"
                    type="date"
                    value={draft.expiresAt}
                    onValueChange={(value) => setField("expiresAt", value)}
                    isInvalid={!!formErrors.expiresAt}
                    errorMessage={formErrors.expiresAt}
                  />
                </div>
                <Switch isSelected={draft.active} onValueChange={(value) => setField("active", value)}>
                  {editing ? "Active" : "Active right away"}
                </Switch>
              </ModalBody>
              <ModalFooter>
                <UiButton variant="ghost" onPress={closeForm} isDisabled={saving}>
                  Cancel
                </UiButton>
                <UiButton variant="primary" isLoading={saving} onPress={() => void handleSave()}>
                  {editing ? "Save changes" : "Create discount"}
                </UiButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmModal
        isOpen={deactivateTarget != null}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        title={`Deactivate ${deactivateTarget?.code ?? ""}?`}
        description="The code can no longer be applied. Invoices that already use it are not changed."
        confirmLabel="Deactivate"
        confirmColor="danger"
      />
    </>
  );
}
