import { addToast, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type Selection } from "@heroui/react";
import { useMemo, useState } from "react";
import type { Coupon, PlanName } from "../../types";
import { selectionToIdSet } from "../../lib/tableSelection";
import { formatDate } from "../../lib/utils";
import { getInputClasses, getSelectClasses } from "../../styles/inputStyle";
import { dataTableFillClassNames, dataTableSelectionProps, tablePanelFillClassName } from "../common/dataTableStyles";
import { dashboardModalProps } from "../common/modalStyles";
import {
  FilterCheckboxGroup,
  TableToolbar,
} from "../common/TableToolbar";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import { Button as UiButton } from "../ui";

export interface CouponsTabProps {
  coupons: Coupon[];
  onCreate: (coupon: Coupon) => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

const columns = [
  { key: "code", label: "Code" },
  { key: "discount", label: "Discount" },
  { key: "appliesTo", label: "Applies To" },
  { key: "redemptions", label: "Redemptions" },
  { key: "expiresAt", label: "Expires" },
  { key: "active", label: "Status" },
] as const;

const planOptions: Array<PlanName | "All"> = [
  "All",
  "Free",
  "Starter",
  "Pro",
  "Enterprise",
];

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
        String(coupon.appliesTo).toLowerCase().includes(query);
      const statusKey = coupon.active ? "active" : "inactive";
      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(statusKey);
      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const dataColumns = columns.filter((column) =>
    visibleColumns.includes(column.key),
  );
  const headerColumns = dataColumns;

  const handleSelectionChange = (keys: Selection) => {
    setSelected(selectionToIdSet(keys, filtered.map((item) => item.id)));
  };

  const renderCell = (coupon: Coupon, key: string) => {
    switch (key) {
      case "code":
        return <span className="font-mono font-bold">{coupon.code}</span>;
      case "discount":
        return coupon.discountType === "percent"
          ? `${coupon.discountValue}%`
          : `₹${coupon.discountValue}`;
      case "appliesTo":
        return coupon.appliesTo;
      case "redemptions":
        return `${coupon.redemptions}/${coupon.maxRedemptions}`;
      case "expiresAt":
        return formatDate(coupon.expiresAt);
      case "active":
        return (
          <Chip
            size="sm"
            variant="flat"
            color={coupon.active ? "success" : "default"}
            className="h-7 rounded-full px-3"
          >
            {coupon.active ? "Active" : "Inactive"}
          </Chip>
        );
      default:
        return "—";
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
      addToast({ title: "Code required", color: "danger" });
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      addToast({ title: "Invalid discount value", color: "danger" });
      return;
    }
    if (Number.isNaN(max) || max <= 0) {
      addToast({ title: "Invalid max redemptions", color: "danger" });
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
      title: "Discount created",
      description: `${trimmed} is ready to use (local demo).`,
      color: "success",
    });
  };

  return (
    <>
      <Card shadow="none" className={tablePanelFillClassName}>
        <CardBody className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search for discount details..."
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
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            }
          />
          <Table
            aria-label="Discounts table"
            {...dataTableSelectionProps}
            selectedKeys={selected}
            onSelectionChange={handleSelectionChange}
            classNames={dataTableFillClassNames}
          >
            <TableHeader columns={headerColumns}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={filtered}
              emptyContent={
                <NoDataPlaceholder
                  title="No discounts yet"
                  description="Create a discount code to get started."
                  buttonLabel="Create discount"
                  onButtonClick={() => onCreateOpenChange(true)}
                />
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
        </CardBody>
      </Card>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          onCreateOpenChange(false);
          resetForm();
        }}
        size="2xl"
        {...dashboardModalProps}
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Create discount</ModalHeader>
              <ModalBody>
                <Input
                  label="Code"
                  labelPlacement="outside"
                  placeholder="SAVE20"
                  value={code}
                  onValueChange={setCode}
                  classNames={getInputClasses()}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Discount type"
                    labelPlacement="outside"
                    selectedKeys={new Set([discountType])}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      if (value === "percent" || value === "fixed") setDiscountType(value);
                    }}
                    disallowEmptySelection
                    classNames={getSelectClasses()}
                  >
                    <SelectItem key="percent">Percent</SelectItem>
                    <SelectItem key="fixed">Fixed (₹)</SelectItem>
                  </Select>
                  <Input
                    label="Discount value"
                    labelPlacement="outside"
                    placeholder="0"
                    type="number"
                    value={discountValue}
                    onValueChange={setDiscountValue}
                    classNames={getInputClasses()}
                  />
                </div>
                <Select
                  label="Applies to"
                  labelPlacement="outside"
                  selectedKeys={new Set([appliesTo])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (typeof value === "string") setAppliesTo(value as PlanName | "All");
                  }}
                  disallowEmptySelection
                  classNames={getSelectClasses()}
                >
                  {planOptions.map((option) => (
                    <SelectItem key={option}>{option}</SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Max redemptions"
                    labelPlacement="outside"
                    placeholder="100"
                    type="number"
                    value={maxRedemptions}
                    onValueChange={setMaxRedemptions}
                    classNames={getInputClasses()}
                  />
                  <Input
                    label="Expires at"
                    labelPlacement="outside"
                    type="date"
                    value={expiresAt}
                    onValueChange={setExpiresAt}
                    classNames={getInputClasses()}
                  />
                </div>
                <Switch isSelected={active} onValueChange={setActive}>
                  Active immediately
                </Switch>
              </ModalBody>
              <ModalFooter>
                <UiButton variant="danger-outline" size="sm" onPress={close}>
                  Cancel
                </UiButton>
                <UiButton variant="primary" size="sm" onPress={handleCreate}>
                  Save
                </UiButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
