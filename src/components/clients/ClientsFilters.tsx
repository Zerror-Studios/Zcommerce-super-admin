import { Input, Select, SelectItem } from "@heroui/react";
import type { ClientStatus, PlanName } from "../../types";
import { getInputClasses } from "../../styles/inputStyle";
import { IconSearch } from "../ui/icons";

export type PlanFilter = PlanName | "all";
export type StatusFilter = ClientStatus | "all";

export interface ClientsFiltersProps {
  search: string;
  plan: PlanFilter;
  status: StatusFilter;
  onSearchChange: (value: string) => void;
  onPlanChange: (value: PlanFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
}

const planOptions: { key: PlanFilter; label: string }[] = [
  { key: "all", label: "All plans" },
  { key: "Free", label: "Free" },
  { key: "Starter", label: "Starter" },
  { key: "Pro", label: "Pro" },
  { key: "Enterprise", label: "Enterprise" },
];

const statusOptions: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "trial", label: "Trial" },
  { key: "suspended", label: "Suspended" },
];

export function ClientsFilters({
  search,
  plan,
  status,
  onSearchChange,
  onPlanChange,
  onStatusChange,
}: ClientsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        aria-label="Search clients"
        placeholder="Search by store name or email..."
        value={search}
        onValueChange={onSearchChange}
        startContent={<IconSearch size={16} className="text-default-400" />}
        className="w-full sm:max-w-sm"
        classNames={getInputClasses("!rounded-full")}
      />
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
        <Select
          aria-label="Filter by plan"
          selectedKeys={new Set([plan])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            if (typeof value === "string") onPlanChange(value as PlanFilter);
          }}
          className="w-full sm:w-40"
          radius="lg"
          disallowEmptySelection
        >
          {planOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          selectedKeys={new Set([status])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            if (typeof value === "string") onStatusChange(value as StatusFilter);
          }}
          className="w-full sm:w-44"
          radius="lg"
          disallowEmptySelection
        >
          {statusOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
}
