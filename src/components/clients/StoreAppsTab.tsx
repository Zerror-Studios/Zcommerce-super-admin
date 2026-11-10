/**
 * Store › Apps (design v2 §1A "SA Store › Apps", §7; board 63-SA-Store-Apps): the summary panel (Connected apps,
 * Need attention, Payments through, Last sync), the toolbar above the table (All / Need attention, search), then
 * one aligned grid table: App, Type, Status, Last sync, Note, Action. Tabs: Connected (every connection) and Need
 * attention; "Suggested" waits for suggestion data. Under it, the store's Google Analytics card
 * (the old Analytics section: traffic, sync health, data through, Re-run sync).
 *
 * Rows come from `platformIntegrationHealth` (use-store-apps.ts). Action: "Re-run sync" for an analytics
 * connection the sync monitor knows. Not built, no data (backend gaps): "Suggested for this store", the
 * "Of N available" count, per-app actions such as Make default or Move to another gateway, and notes other than
 * the last error.
 *
 * Also exports ConnectedAppsCard, the small block on Overview.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTenantSyncRows } from "../../hooks/use-platform-analytics";
import { useTenantProfile } from "../../hooks/use-tenant-profile";
import { errorPreview } from "../../lib/analytics-health";
import { getAppProviderLabel, getChannelTypeLabel } from "../../lib/display-labels.util";
import { paymentProviderLabel } from "../../lib/store-profile.util";
import type { Client } from "../../types";
import type { IntegrationHealthRow } from "../../types/platform-api";
import { AnalyticsHealthChip, IntegrationStatusChip } from "../analytics/AnalyticsHealthChip";
import { RerunSyncButton } from "../analytics/RerunSyncButton";
import {
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  IconTile,
  SummaryPanel,
  TableToolbar,
  formatCount,
  formatDate,
  formatRelative,
  type DataTableColumn,
  type SummaryCell,
} from "../ui";
import { IconApps } from "../ui/icons";
import { ClientAnalyticsCard } from "./ClientAnalyticsCard";
import { SkelChip, SkelLine } from "../common/SkeletonBits";
import { lastSyncOf, needsAttention, useStoreApps } from "./use-store-apps";

type AppsTab = "all" | "attention";

const COLUMNS: DataTableColumn[] = [
  { key: "app", label: "App", mobile: "primary" },
  { key: "type", label: "Type", width: 130, mobile: "title" },
  { key: "status", label: "Status", width: 130, skeleton: "badge", mobile: "badge" },
  { key: "lastSync", label: "Last sync", width: 150, mobile: "meta" },
  { key: "note", label: "Note", width: 240, hideWhen: "narrow", mobile: "hide" },
  // Phone: the rerun button sits with the status on line 3, so it stays reachable (the cards have no row tap).
  { key: "action", label: "Action", width: 150, hideLabel: true, mobile: "badge" },
];

/** A neutral tile with the app's initials (§2.1: no coloured app tiles). */
export function AppTile({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?";
  return (
    <IconTile tone="neutral" size={size}>
      <span className="text-caption font-semibold">{initials}</span>
    </IconTile>
  );
}

const noteOf = (row: IntegrationHealthRow): string | null => {
  const error = errorPreview(row.lastError);
  if (error) return error;
  if (row.dataThrough) return `Data through ${formatDate(row.dataThrough)}`;
  if (row.lastTestedAt) return `Tested ${formatDate(row.lastTestedAt)}`;
  return null;
};

export function StoreAppsTab({ client }: { client: Client }) {
  const apps = useStoreApps(client);
  const syncRows = useTenantSyncRows(client.id);
  const profile = useTenantProfile(client.id);
  const [tab, setTab] = useState<AppsTab>("all");
  const [search, setSearch] = useState("");

  const attention = apps.rows.filter(needsAttention);
  const lastSync = lastSyncOf(apps.rows);
  const paymentApp = paymentProviderLabel(profile.tenant?.paymentProvider);
  const connected = apps.rows.filter((row) => String(row.status).toUpperCase() === "ACTIVE").length;
  const syncByConnection = useMemo(
    () => new Map(syncRows.data.map((row) => [row.connectionId, row])),
    [syncRows.data],
  );

  const term = search.trim().toLowerCase();
  const rows = (tab === "attention" ? attention : apps.rows).filter(
    (row) =>
      !term ||
      [getAppProviderLabel(row.provider), getChannelTypeLabel(row.channelType)].some((text) => text.toLowerCase().includes(term)),
  );

  const attentionNames = attention.map((row) => getAppProviderLabel(row.provider));
  const cells: SummaryCell[] = [
    {
      key: "connected",
      label: "Connected apps",
      value: formatCount(connected),
      note: apps.rows.length > connected ? `${formatCount(apps.rows.length)} installed` : "All switched on",
      chart: apps.rows.length ? { kind: "segments", filled: connected, total: Math.max(apps.rows.length, 1) } : undefined,
    },
    {
      key: "attention",
      label: "Need attention",
      value: formatCount(attention.length),
      note: attention.length ? attentionNames.slice(0, 2).join(" and ") : "Nothing failing",
      tone: attention.length ? "danger" : "default",
    },
    {
      key: "payments",
      label: "Payments through",
      value: paymentApp ?? "—",
      note: paymentApp ? undefined : "No payment app set",
    },
    {
      key: "sync",
      label: "Last sync",
      value: lastSync ? formatRelative(lastSync) : "—",
      note: lastSync ? formatDate(lastSync) : "No sync yet",
      chart: lastSync ? { kind: "dots" } : undefined,
    },
  ];

  const renderCell = (row: IntegrationHealthRow, key: string) => {
    switch (key) {
      case "app": {
        const name = getAppProviderLabel(row.provider);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <AppTile name={name} size="sm" />
            <span className="truncate text-body font-medium text-fg">{name}</span>
          </div>
        );
      }
      case "type":
        return <span className="text-fg-muted">{getChannelTypeLabel(row.channelType)}</span>;
      case "status":
        return (
          <div className="flex flex-col items-start gap-0.5">
            <IntegrationStatusChip status={row.status} />
            {row.analyticsHealth ? <AnalyticsHealthChip health={row.analyticsHealth} /> : null}
          </div>
        );
      case "lastSync":
        return row.lastSyncAt ? (
          <span className="num" title={formatDate(row.lastSyncAt)}>
            Synced {formatRelative(row.lastSyncAt)}
          </span>
        ) : (
          <span className="text-fg-subtle">Never synced</span>
        );
      case "note": {
        const note = noteOf(row);
        return note ? (
          <span className={row.lastError ? "block truncate text-tone-danger-text" : "block truncate text-fg-muted"} title={row.lastError ?? undefined}>
            {note}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      }
      case "action": {
        const sync = syncByConnection.get(row.connectionId);
        return sync ? <RerunSyncButton row={sync} /> : null;
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SummaryPanel cells={cells} isLoading={apps.loading} storageKey="store:apps" aria-label="Apps summary" />

      {apps.error ? (
        <ErrorState title="Couldn't load this store's apps." onRetry={() => void apps.refetch()} />
      ) : (
        <DataTable<IntegrationHealthRow>
          aria-label={`${client.storeName} apps`}
          columns={COLUMNS}
          rows={rows}
          getRowKey={(row) => row.connectionId}
          renderCell={renderCell}
          isLoading={apps.loading}
          toolbar={
            <TableToolbar<AppsTab>
              tabs={[
                { value: "all", label: "Connected", count: apps.rows.length },
                { value: "attention", label: "Need attention", count: attention.length },
              ]}
              tab={tab}
              onTabChange={setTab}
              tabsLabel="Which apps"
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search apps"
            />
          }
          emptyContent={
            term ? (
              <EmptyState kind="no-results" icon={IconApps} onClearFilters={() => setSearch("")} />
            ) : tab === "attention" ? (
              <EmptyState icon={IconApps} title="Every app is working" description="Apps with a connection error or switched off show here." />
            ) : (
              <EmptyState icon={IconApps} title="No apps connected yet" description="Payment, shipping, messaging and analytics apps the owner connects show here." />
            )
          }
        />
      )}

      {/* The old Analytics section (PRD-012 FR-8.3): GA4 traffic, sync health and Re-run sync. */}
      <section id="analytics" className="scroll-mt-[calc(var(--zc-sticky-header-h,4.5rem)+1rem)]">
        <ClientAnalyticsCard client={client} />
      </section>
    </div>
  );
}

/** Overview's Connected apps block (board 60): neutral tiles, the status, and a link to the Apps tab. */
export function ConnectedAppsCard({ client }: { client: Client }) {
  const apps = useStoreApps(client);
  const sorted = [...apps.rows].sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));
  return (
    <Card
      title="Connected apps"
      actions={
        <Link to={`/stores/${client.id}/apps`} className="text-label text-brand hover:underline">
          Apps tab
        </Link>
      }
    >
      {apps.loading ? (
        // Loading pass: the loaded app rows (tile, name, status chip) in the same grid.
        <ul aria-busy className="grid grid-cols-1 gap-2 @min-[40rem]:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="flex min-w-0 items-center gap-3 rounded-card bg-surface-sunken px-3 py-2">
              <span aria-hidden className="zc-skel size-7 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <SkelLine className="w-2/3" />
              </span>
              <SkelChip />
            </li>
          ))}
        </ul>
      ) : apps.error ? (
        <ErrorState inline title="Couldn't load the apps." onRetry={() => void apps.refetch()} />
      ) : sorted.length === 0 ? (
        <p className="text-body text-fg-muted">No apps connected yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 @min-[40rem]:grid-cols-3">
          {sorted.slice(0, 6).map((row) => {
            const name = getAppProviderLabel(row.provider);
            return (
              <li key={row.connectionId} className="flex min-w-0 items-center gap-3 rounded-card bg-surface-sunken px-3 py-2">
                <AppTile name={name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-body text-fg">{name}</span>
                <IntegrationStatusChip status={row.status} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
