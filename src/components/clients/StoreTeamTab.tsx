/**
 * Store › Team (design v2 §7; board 62-SA-Store-Team; backend PRD-035 item 4).
 *
 * The store's staff from `platformTenantStaff(tenantId)` (owner first, then by name; the same people the store's
 * Settings › Team lists): a grey avatar with name and email, the role (owner first), the status, an "Invite
 * pending" chip for people who haven't set a password yet, and when they were last active (amber after 30 days).
 * Above the table: the seat line (people on the team against the plan's staff limit) and a search box.
 *
 * Not shown on purpose: the board's Two-step column and its warning banner. Store staff have no two-step login yet
 * (`twoFactorEnabled` is always false), so a column would only ever say "Off".
 */

import { useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
import { PLATFORM_TENANT_STAFF } from "../../graphql/tenants";
import { errorCodeOf, errorReasonOf } from "../../lib/apollo-client";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { clientPlanLabel } from "../../lib/plan-identity.util";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import type { PlatformTenantStaffMember } from "../../types/platform-api";
import {
  Avatar,
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  TableToolbar,
  formatCount,
  formatDate,
  formatDateTime,
  type DataTableColumn,
  type Tone,
} from "../ui";
import { IconCustomers } from "../ui/icons";

const COLUMNS: DataTableColumn[] = [
  { key: "person", label: "Person", skeleton: "avatar", mobile: "primary" },
  { key: "role", label: "Role", width: 170, skeleton: "badge", mobile: "badge" },
  { key: "status", label: "Status", width: 220, skeleton: "badge", mobile: "badge" },
  { key: "lastActive", label: "Last active", width: 160, mobile: "meta" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 30;

const STATUS: Record<PlatformTenantStaffMember["status"], { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  BLOCKED: { label: "Blocked", tone: "danger" },
};

/** "OWNER" / "STORE_MANAGER" → "Owner" / "Store manager"; custom role names stay as written. */
function staffRoleLabel(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return "—";
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  const words = trimmed.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Now" · "Today, 9:40 AM" · "Yesterday" · "3 Nov"; "Never" without a sign-in. */
function lastActiveLabel(value: string | null, now: Date = new Date()): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "Now";
  if (date.toDateString() === now.toDateString()) {
    const clock = formatDateTime(date, now).split(", ").pop();
    return `Today, ${clock}`;
  }
  if (date.toDateString() === new Date(now.getTime() - DAY_MS).toDateString()) return "Yesterday";
  return formatDate(date, now);
}

/** Last active more than 30 days ago (an invited person who never joined is not "stale"). */
function isStale(value: string | null, now: Date = new Date()): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && now.getTime() - time > STALE_DAYS * DAY_MS;
}

/** Owner first, then by name (the backend already orders it; kept here so the table never depends on it). */
function ownerFirst(rows: PlatformTenantStaffMember[]): PlatformTenantStaffMember[] {
  return [...rows].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));
}

export function StoreTeamTab({ client }: { client: Client }) {
  const { can } = useAuth();
  const allowed = can(PLATFORM_PERMISSIONS.TENANTS_READ);
  const query = useQuery<{ platformTenantStaff: PlatformTenantStaffMember[] }>(PLATFORM_TENANT_STAFF, {
    variables: { tenantId: client.id },
    skip: !allowed || !client.id,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const [search, setSearch] = useState("");

  const staff = useMemo(() => ownerFirst(query.data?.platformTenantStaff ?? []), [query.data]);
  const term = search.trim().toLowerCase();
  const rows = term
    ? staff.filter((row) => [row.name, row.email, staffRoleLabel(row.role)].some((text) => text.toLowerCase().includes(term)))
    : staff;

  if (!allowed) {
    return (
      <Card>
        <EmptyState icon={IconCustomers} title="You can't see this store's team" description="Your role doesn't include reading store details." />
      </Card>
    );
  }

  const limit = client.planRef?.limits.staff ?? null;
  const loaded = !!query.data;
  const seatCount = loaded ? staff.length : client.hasUsage !== false && client.staffCount != null ? client.staffCount : null;
  const seatLine =
    seatCount == null
      ? null
      : `${formatCount(seatCount)} ${seatCount === 1 ? "person" : "people"} on the team · ${
          limit == null ? `no limit on ${clientPlanLabel(client)}` : `${formatCount(limit)} allowed on ${clientPlanLabel(client)}`
        }`;

  if (query.error && !query.data) {
    const reason = errorReasonOf(query.error);
    const code = errorCodeOf(query.error);
    return (
      <Card>
        {reason === "STORE_DB_UNAVAILABLE" ? (
          <div role="status" className="flex flex-col items-start gap-3">
            <p className="text-body text-fg-muted">
              The store's database can't be reached right now, so its team can't be listed. Try again in a moment.
            </p>
            <Button variant="secondary" size="sm" isLoading={query.loading} onPress={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : code === "NOT_FOUND" ? (
          <EmptyState icon={IconCustomers} title="This store couldn't be found" description="It may have been removed." />
        ) : (
          <ErrorState title="Couldn't load this store's team." onRetry={() => void query.refetch()} />
        )}
      </Card>
    );
  }

  const renderCell = (row: PlatformTenantStaffMember, key: string) => {
    switch (key) {
      case "person":
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={row.name || row.email} size="md" />
            <div className="min-w-0">
              <p className="truncate text-body font-medium text-fg">{row.name || row.email}</p>
              <p className="truncate text-caption text-fg-muted">{row.email}</p>
            </div>
          </div>
        );
      case "role":
        return (
          <Chip dot={false} tone="neutral">
            {row.isOwner ? "Owner" : staffRoleLabel(row.role)}
          </Chip>
        );
      case "status": {
        const status = STATUS[row.status] ?? { label: staffRoleLabel(row.status), tone: "neutral" as Tone };
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={status.tone}>{status.label}</Chip>
            {row.invitePending ? (
              <Chip tone="info" dot={false}>
                Invite pending
              </Chip>
            ) : null}
          </div>
        );
      }
      case "lastActive": {
        if (!row.lastActiveAt) {
          return <span className="text-fg-subtle">{row.invitePending ? "Not joined yet" : "Never"}</span>;
        }
        const stale = isStale(row.lastActiveAt);
        return (
          <span className={stale ? "num text-tone-warning" : "num text-fg-muted"} title={formatDateTime(row.lastActiveAt)}>
            {lastActiveLabel(row.lastActiveAt)}
          </span>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {seatLine ? <p className="num text-body text-fg-muted">{seatLine}</p> : null}
      <DataTable<PlatformTenantStaffMember>
        aria-label={`${client.storeName} team`}
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        renderCell={renderCell}
        rowHeight="tall"
        isLoading={query.loading && !query.data}
        isReloading={query.loading && !!query.data}
        toolbar={
          <TableToolbar<string> search={search} onSearchChange={setSearch} searchPlaceholder="Search people" />
        }
        emptyContent={
          term ? (
            <EmptyState kind="no-results" icon={IconCustomers} onClearFilters={() => setSearch("")} />
          ) : (
            <EmptyState
              icon={IconCustomers}
              title="No one on this team yet"
              description="The owner and the staff they invite from the store's Settings › Team show here."
            />
          )
        }
      />
    </div>
  );
}
