/**
 * zcom-super-admin — Subscription lookup
 *
 * A client can hold several subscriptions over time (a cancelled one plus
 * its replacement, an upgrade, …). `new Map(subs.map(s => [s.clientId, s]))`
 * silently keeps whichever came last in the array (PRD-002 SA-5). These
 * helpers pick the **latest** subscription per client by date instead.
 *
 * Usage: `latestSubscriptionByClient(subscriptions).get(client.id)`.
 */
import type { Subscription } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Sort key: start date, falling back to the renewal date. */
function subscriptionTime(subscription: Subscription): number {
  const time = new Date(
    subscription.startedAt ?? subscription.renewalDate,
  ).getTime();

  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** True when `candidate` is later than `current` (ties keep `current`). */
function isLater(candidate: Subscription, current: Subscription): boolean {
  const candidateTime = subscriptionTime(candidate);
  const currentTime = subscriptionTime(current);

  if (candidateTime !== currentTime) return candidateTime > currentTime;

  return (
    new Date(candidate.renewalDate).getTime() >
    new Date(current.renewalDate).getTime()
  );
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Latest subscription per client id.
 * With `asOf`, subscriptions that start after it are ignored. Default: none.
 */
export function latestSubscriptionByClient(
  subscriptions: Subscription[],
  asOf?: Date,
): Map<string, Subscription> {
  const byClient = new Map<string, Subscription>();
  const cutoff = asOf?.getTime();

  for (const subscription of subscriptions) {
    if (cutoff !== undefined && subscriptionTime(subscription) > cutoff) {
      continue;
    }

    const current = byClient.get(subscription.clientId);
    if (!current || isLater(subscription, current)) {
      byClient.set(subscription.clientId, subscription);
    }
  }

  return byClient;
}

/** Latest subscription for one client, or `undefined`. */
export function findLatestSubscription(
  subscriptions: Subscription[],
  clientId: string,
): Subscription | undefined {
  return latestSubscriptionByClient(
    subscriptions.filter((subscription) => subscription.clientId === clientId),
  ).get(clientId);
}

// ─── Collections plan filter (PRD-024 FR-1.2, D-02) ──────────────────────

/**
 * The `planId` that makes `platformCollections` filter by a plan **tier**.
 * The server compares tiers, but looks the id up only among the plan
 * versions stores are subscribed to; a version nobody is on (a newer one,
 * or another store's custom plan) emptied the table. So send a version some
 * subscription is on; with none on that tier, any version of the tier (the
 * server then rightly finds no store).
 */
export function collectionsPlanIdForTier(
  tier: string,
  subscriptions: readonly Subscription[],
  plans: readonly { id: string; name: string }[],
): string | null {
  const subscribed = subscriptions.find(
    (subscription) => subscription.plan === tier && subscription.planId,
  );
  if (subscribed?.planId) return subscribed.planId;
  return plans.find((plan) => plan.name === tier)?.id ?? null;
}
