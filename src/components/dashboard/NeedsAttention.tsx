import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Client, Subscription } from "../../types";
import { getStoreHealth } from "../../lib/storeHealth";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { paymentState } from "../../lib/storeStatus";
import { daysUntil, formatDate } from "../../lib/utils";
import { Card, Skeleton, cx, getHealthBand, toneDotClasses, type Tone } from "../ui";

export interface NeedsAttentionProps {
  clients: Client[];
  subscriptions: Subscription[];
  now: Date;
  isLoading?: boolean;
}

interface AttentionItem {
  key: string;
  tone: Tone;
  title: ReactNode;
  detail: ReactNode;
  href: string;
}

function names(list: Client[]): string {
  return list.map((client) => client.storeName).join(", ");
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * "Needs attention" (docs/design/04-super-admin.md §3.1), ordered by urgency: overdue stores, payments due
 * soon, health drops (Critical band), suspended stores. Every row opens the related store or list.
 */
function buildItems({ clients, subscriptions, now }: NeedsAttentionProps): AttentionItem[] {
  const subByClient = latestSubscriptionByClient(subscriptions);
  const items: AttentionItem[] = [];
  const active = clients.filter((client) => client.status !== "suspended");

  // 1. Overdue stores, most overdue first.
  active
    .map((client) => {
      const sub = subByClient.get(client.id);
      const state = paymentState(sub);
      return { client, sub, state };
    })
    .filter(({ sub, state }) => sub && state.tone === "danger")
    .map(({ client, sub, state }) => ({ client, state, days: -daysUntil(sub!.renewalDate, now) }))
    .sort((a, b) => b.days - a.days)
    .forEach(({ client, state, days }) => {
      items.push({
        key: `overdue-${client.id}`,
        tone: "danger",
        title: (
          <>
            <span className="font-medium">{client.storeName}</span> is overdue by {plural(days, "day", "days")}
          </>
        ),
        detail: state.detail ?? "Payment overdue",
        href: `/stores/${client.id}`,
      });
    });

  // 2. Payments due soon, grouped by due date.
  const dueByDate = new Map<string, Client[]>();
  active.forEach((client) => {
    const sub = subByClient.get(client.id);
    const state = paymentState(sub);
    if (sub && state.tone === "warning") {
      const list = dueByDate.get(sub.renewalDate) ?? [];
      list.push(client);
      dueByDate.set(sub.renewalDate, list);
    }
  });
  [...dueByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, due]) => {
      items.push({
        key: `due-${date}`,
        tone: "warning",
        title: `${plural(due.length, "payment", "payments")} due on ${formatDate(date)}`,
        detail: names(due),
        href: due.length === 1 ? `/stores/${due[0].id}` : "/stores?status=unpaid",
      });
    });

  // 3. Health drops: stores in the Critical band.
  active
    .map((client) => ({ client, health: getStoreHealth(client) }))
    .filter(({ health }) => getHealthBand(health.score).tone === "danger")
    .sort((a, b) => a.health.score - b.health.score)
    .forEach(({ client, health }) => {
      items.push({
        key: `health-${client.id}`,
        tone: "warning",
        title: (
          <>
            <span className="font-medium">{client.storeName}</span> health is {health.score}
          </>
        ),
        detail: health.factors.slice(1, 3).join(" · "),
        href: `/stores/${client.id}`,
      });
    });

  // 4. Suspended stores.
  const suspended = clients.filter((client) => client.status === "suspended");
  if (suspended.length > 0) {
    items.push({
      key: "suspended",
      tone: "neutral",
      title: `${plural(suspended.length, "store is", "stores are")} suspended`,
      detail: names(suspended),
      href: suspended.length === 1 ? `/stores/${suspended[0].id}` : "/stores?status=suspended",
    });
  }

  return items;
}

export function NeedsAttention(props: NeedsAttentionProps) {
  const navigate = useNavigate();
  const { clients, subscriptions, now, isLoading } = props;
  const items = useMemo(
    () => buildItems({ clients, subscriptions, now }),
    [clients, subscriptions, now],
  );

  return (
    <Card title="Needs attention" padding="none" className="h-full">
      {isLoading ? (
        <div className="space-y-3 px-5 pb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ul className="border-t border-line-subtle">
          {items.map((item) => (
            <li key={item.key} className="border-b border-line-subtle">
              <button
                type="button"
                onClick={() => navigate(item.href)}
                className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors duration-instant ease-standard hover:bg-surface-muted focus-visible:shadow-focus"
              >
                <span aria-hidden className={cx("mt-2 size-1.5 shrink-0 rounded-full", toneDotClasses[item.tone])} />
                <span className="min-w-0">
                  <span className="block text-body text-fg">{item.title}</span>
                  {item.detail ? <span className="block truncate text-label text-fg-muted">{item.detail}</span> : null}
                </span>
              </button>
            </li>
          ))}
          <li className="px-5 py-3 text-label text-fg-muted">
            {items.length > 0 ? "You're caught up on everything else." : "You're all caught up."}
          </li>
        </ul>
      )}
    </Card>
  );
}
