import type { ComponentType } from "react";
import { StatCard as SharedStatCard } from "../ui/StatCard";

export interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  isLoading?: boolean;
}

/** Kept for existing call sites; renders the shared StatCard (component-specs §19). */
export function StatCard({ title, value, change, icon, isLoading }: StatCardProps) {
  return <SharedStatCard label={title} value={value} delta={change} icon={icon} isLoading={isLoading} />;
}
