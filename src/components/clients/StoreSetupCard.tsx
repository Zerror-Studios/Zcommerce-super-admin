/**
 * Store › Setup (backend PRD-031 FR-D2, FR-D3): what the store still needs
 * before it sells, from `platformStoreSetup` (read live, read-only, from
 * the store DB and the master): payment app, senders, shipping, stock
 * location, profile, invoice details, shopper emails, domain, catalog and
 * the owner's sign-in. Missing rows come first (amber), then checks to
 * look at (grey), then done (green). Shown with `platform:tenants:read`.
 */

import { useQuery } from "@apollo/client";
import { PLATFORM_STORE_SETUP } from "../../graphql/tenants";
import { errorReasonOf } from "../../lib/apollo-client";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  sortStoreSetupChecks,
  storeSetupDoneCount,
  storeSetupLabel,
  storeSetupStatusLabel,
  storeSetupTone,
} from "../../lib/store-setup.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformStoreSetupCheck } from "../../types/platform-api";
import { Button as UiButton, Card, Chip, ErrorState, Skeleton, cx } from "../ui";
import { IconError, IconInfo, IconRefresh, IconSuccess } from "../ui/icons";

export interface StoreSetupCardProps {
  tenantId: string;
}

const STATUS_ICON = { OK: IconSuccess, MISSING: IconError, WARNING: IconInfo } as const;

const STATUS_ICON_CLASS = {
  OK: "text-tone-success",
  MISSING: "text-tone-warning",
  WARNING: "text-fg-subtle",
} as const;

export function StoreSetupCard({ tenantId }: StoreSetupCardProps) {
  const { can } = useAuth();
  const allowed = can(PLATFORM_PERMISSIONS.TENANTS_READ);
  const query = useQuery<{ platformStoreSetup: PlatformStoreSetupCheck[] }>(PLATFORM_STORE_SETUP, {
    variables: { tenantId },
    skip: !allowed || !tenantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  if (!allowed) return null;

  const checks = sortStoreSetupChecks(query.data?.platformStoreSetup ?? []);
  const unavailable = errorReasonOf(query.error) === "STORE_DB_UNAVAILABLE";

  return (
    <Card
      title="Setup"
      description={
        checks.length
          ? `${storeSetupDoneCount(checks)} of ${checks.length} done. What the store still needs before it sells.`
          : "What the store still needs before it sells."
      }
      padding="none"
      actions={
        <UiButton
          variant="ghost"
          size="sm"
          startIcon={<IconRefresh aria-hidden />}
          isLoading={query.loading && !!query.data}
          onPress={() => void query.refetch()}
        >
          Refresh
        </UiButton>
      }
    >
      {query.error && !query.data ? (
        <div className="px-5 pb-5">
          {unavailable ? (
            <p role="status" className="text-body text-fg-muted">
              The store's database can't be reached, so its setup can't be checked. Retry provisioning, then refresh.
            </p>
          ) : (
            <ErrorState inline title="Couldn't load the setup checks." onRetry={() => void query.refetch()} />
          )}
        </div>
      ) : query.loading && !query.data ? (
        <div className="flex flex-col gap-2 px-5 pb-5" role="status" aria-label="Loading setup checks">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : checks.length === 0 ? (
        <p className="px-5 pb-5 text-body text-fg-muted">No checks returned.</p>
      ) : (
        <ul className="mx-5 mb-2 divide-y divide-line-subtle border-t border-line-subtle" aria-label="Setup checks">
          {checks.map((check) => {
            const Icon = STATUS_ICON[check.status] ?? IconInfo;
            return (
              <li key={check.key} className="flex min-h-14 items-center gap-3 py-2">
                <Icon aria-hidden className={cx("size-5 shrink-0", STATUS_ICON_CLASS[check.status] ?? "text-fg-subtle")} />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-fg">{storeSetupLabel(check.key)}</p>
                  <p className="text-label text-fg-muted">{check.detail}</p>
                </div>
                <Chip tone={storeSetupTone(check.status)}>{storeSetupStatusLabel(check.status)}</Chip>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
