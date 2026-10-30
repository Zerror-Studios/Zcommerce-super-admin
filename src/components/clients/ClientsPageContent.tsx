import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../../types";
import { toasts } from "../../copy";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { storeLifecycleEnum, storeLifecycleKey, graceDaysFor } from "../../lib/storeStatus";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { PageHeader } from "../common/PageHeader";
import { IconAdd, IconStore } from "../ui/icons";
import { Button, ErrorState, cx, formatCount, toneTextClasses } from "../ui";
import { StoresTable } from "./stores-list/StoresTable";
import { paymentBadge, paymentKindEnum } from "./stores-list/store-list.util";

export interface ClientsPageContentProps {
  clients: Client[];
}

/**
 * Stores (04 S-02): blue header tile with the storefront glyph, the count of stores that aren't deleted and a live
 * line ("2 live · 1 in trial · 1 payment due · 0 overdue"), primary "+ Add store"; then the stores table card.
 */
export function ClientsPageContent({ clients }: ClientsPageContentProps) {
  const navigate = useNavigate();
  const { loading, loadingMore, incomplete, pageGuardReached, loadRemaining, error, refetch, totalCount, subscriptions } =
    useClients();
  const { settings } = usePlatformSettings();
  const { can } = useAuth();

  const summary = useMemo(() => {
    const byClient = latestSubscriptionByClient(subscriptions);
    let live = 0;
    let trial = 0;
    let due = 0;
    let overdue = 0;
    clients.forEach((client) => {
      const key = storeLifecycleKey(client);
      if (key === storeLifecycleEnum.LIVE) live += 1;
      if (key === storeLifecycleEnum.TRIAL) trial += 1;
      const { kind } = paymentBadge(byClient.get(client.id), graceDaysFor(client, settings.gracePeriodDays));
      if (kind === paymentKindEnum.DUE) due += 1;
      if (kind === paymentKindEnum.GRACE || kind === paymentKindEnum.OVERDUE) overdue += 1;
    });
    const n = (value: number) => <span className="num">{formatCount(value)}</span>;
    return (
      <>
        {n(live)} live · {n(trial)} in trial · {n(due)} payment due · {n(overdue)} overdue
        {/* PRD-024 FR-1.6 (B-06): counted from the loaded rows; say so until every store is loaded. */}
        {clients.length < totalCount ? <> in {n(clients.length)} loaded stores</> : null}
      </>
    );
  }, [clients, settings.gracePeriodDays, subscriptions, totalCount]);

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconStore aria-hidden />}
        section="blue"
        title="Stores"
        count={loading ? undefined : formatCount(totalCount)}
        description={loading ? "Every store on Zcom and its plan" : summary}
        actions={
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
              Add store
            </Button>
          ) : undefined
        }
      />

      {/* Pages of 100 load one after another (FE-09); say so while they do, or if one failed. */}
      {!error && loadingMore ? (
        <p role="status" className="mb-3 text-label text-fg-muted">
          Loading stores… {formatCount(clients.length)} of {formatCount(totalCount)}.
        </p>
      ) : null}
      {incomplete ? (
        <p role="status" className={cx("mb-3 text-label", toneTextClasses.warning)}>
          {pageGuardReached
            ? `Showing the first ${formatCount(clients.length)} of ${formatCount(totalCount)} stores.`
            : `Showing ${formatCount(clients.length)} of ${formatCount(totalCount)} stores; the rest couldn't be loaded.`}{" "}
          <button type="button" className="underline" onClick={loadRemaining}>
            {pageGuardReached ? "Load the next 5,000" : "Try again"}
          </button>
        </p>
      ) : null}

      {error ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <StoresTable clients={clients} isLoading={loading} />
      )}
    </div>
  );
}
