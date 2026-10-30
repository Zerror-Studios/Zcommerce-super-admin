import { useMemo, useState } from "react";
import { DrawerBody, DrawerContent, DrawerHeader } from "@heroui/react";
import type { Client, Subscription } from "../../types";
import { getStoreHealth, isCriticalHealth } from "../../lib/storeHealth";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { paymentState } from "../../lib/storeStatus";
import { formatDate } from "../../lib/utils";
import { AttentionList, ButtonLink, Drawer, cx, type AttentionItem } from "../ui";
import { IconError, IconBlock, IconTime, IconWarning } from "../ui/icons";

export interface NeedsAttentionProps {
  clients: Client[];
  subscriptions: Subscription[];
  now: Date;
  isLoading?: boolean;
}

function names(list: Client[]): string {
  return list.map((client) => client.storeName).join(" · ");
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The console's attention items (04 S-01), newest rules first within each colour: red = overdue stores, orange =
 * payments due soon and stores at risk, blue = suspended stores. Each has one action that opens the place to act.
 */
function buildItems({ clients, subscriptions }: Pick<NeedsAttentionProps, "clients" | "subscriptions">): AttentionItem[] {
  const subByClient = latestSubscriptionByClient(subscriptions);
  const items: AttentionItem[] = [];
  const active = clients.filter((client) => client.status !== "suspended");

  // Red: overdue stores, most overdue first.
  active
    .map((client) => {
      const sub = subByClient.get(client.id);
      const state = paymentState(sub);
      return { client, sub, state };
    })
    .filter(({ sub, state }) => sub && state.tone === "danger")
    // PRD-024 FR-1.7 (B-05): the server's overdue days, not the renewal date.
    .map(({ client, sub, state }) => ({ client, state, days: Math.max(0, sub!.daysOverdue ?? 0) }))
    .sort((a, b) => b.days - a.days)
    .forEach(({ client, state, days }) => {
      items.push({
        id: `overdue-${client.id}`,
        urgency: "red",
        icon: IconError,
        title: `${client.storeName} is overdue`,
        text: [plural(days, "day", "days") + " overdue", state.detail].filter(Boolean).join(" · "),
        action: { label: "View", href: `/stores/${client.id}` },
      });
    });

  // Orange: payments due soon, one tile per due date.
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
        id: `due-${date}`,
        urgency: "orange",
        icon: IconTime,
        title: due.length === 1 ? `${due[0].storeName} pays on ${formatDate(date)}` : `${due.length} payments due on ${formatDate(date)}`,
        text: due.length === 1 ? "Payment due soon" : names(due),
        action: { label: "View", href: due.length === 1 ? `/stores/${due[0].id}` : "/stores?tab=unpaid" },
      });
    });

  // Orange: stores in the Critical health band, as one tile.
  const atRisk = active
    .filter((client) => isCriticalHealth(client))
    .map((client) => ({ client, score: getStoreHealth(client).score }))
    .sort((a, b) => a.score - b.score);
  if (atRisk.length > 0) {
    items.push({
      id: "at-risk",
      urgency: "orange",
      icon: IconWarning,
      title: atRisk.length === 1 ? `${atRisk[0].client.storeName} is at risk` : `${atRisk.length} stores at risk`,
      text: `Health: ${atRisk.map(({ client, score }) => `${client.storeName} ${score}`).join(" · ")}`,
      action: { label: atRisk.length === 1 ? "View store" : "View stores", href: atRisk.length === 1 ? `/stores/${atRisk[0].client.id}` : "/stores" },
    });
  }

  // Blue: suspended stores.
  const suspended = clients.filter((client) => client.status === "suspended");
  if (suspended.length > 0) {
    items.push({
      id: "suspended",
      urgency: "blue",
      icon: IconBlock,
      title: `${plural(suspended.length, "store is", "stores are")} suspended`,
      text: names(suspended),
      action: { label: "Review", href: suspended.length === 1 ? `/stores/${suspended[0].id}` : "/stores?tab=suspended" },
    });
  }

  return items;
}

const toneSoft = { red: "bg-tone-danger-soft", orange: "bg-tone-warning-soft", blue: "bg-tone-info-soft" } as const;
const toneText = { red: "text-tone-danger-text", orange: "text-tone-warning", blue: "text-tone-info" } as const;

/**
 * Needs your attention on Home (04 S-01): the full-width AttentionList with at most 3 tiles (red, orange, blue),
 * each with one secondary action; "See all (n) ›" opens a 400px drawer with every item as 64px rows.
 */
export function NeedsAttention(props: NeedsAttentionProps) {
  const { clients, subscriptions, isLoading } = props;
  const items = useMemo(() => buildItems({ clients, subscriptions }), [clients, subscriptions]);
  const [allOpen, setAllOpen] = useState(false);

  return (
    <>
      <AttentionList
        layout="row"
        items={items}
        loading={isLoading}
        checkedLabel="Zcom AI suggestions · checked just now"
        emptyText="Nothing needs you right now."
        seeAll={items.length > 3 ? { label: `See all (${items.length})`, onPress: () => setAllOpen(true) } : undefined}
      />
      <Drawer isOpen={allOpen} onOpenChange={setAllOpen} size="sm">
        <DrawerContent>
          <DrawerHeader>Needs your attention</DrawerHeader>
          <DrawerBody>
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} className={cx("flex min-h-16 items-center gap-3 rounded-xl px-4 py-3", toneSoft[item.urgency])}>
                    <span aria-hidden className={cx("flex size-8 shrink-0 items-center justify-center rounded-full bg-surface", toneText[item.urgency])}>
                      {Icon ? <Icon aria-hidden className="size-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-body-strong", toneText[item.urgency])}>{item.title}</span>
                      {item.text ? <span className="block truncate text-label text-fg-muted">{item.text}</span> : null}
                    </span>
                    {item.action?.href ? (
                      <ButtonLink variant="secondary" size="sm" to={item.action.href} onClick={() => setAllOpen(false)}>
                        {item.action.label}
                      </ButtonLink>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
