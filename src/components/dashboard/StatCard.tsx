import type { ComponentType } from "react";
import { StatCard as SharedStatCard } from "../ui/StatCard";

export interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  isLoading?: boolean;
}

/** Kept for existing call sites; renders the shared StatCard (docs/design/02-components.md §5, no icon). */
export function StatCard({ title, value, change, icon, isLoading }: StatCardProps) {
  return <SharedStatCard label={title} value={value} delta={change} icon={icon} isLoading={isLoading} />;
}
