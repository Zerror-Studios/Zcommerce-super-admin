/**
 * Home › three action cards (design v2 §7, board 02-V4-SA-Home; round 2 §6.1).
 *
 * Three equal cards in a row, each an eyebrow with a coloured dot, one bold
 * headline, one sentence and one or two buttons:
 *
 * - `NeedsYouAiCard` (ZCOM AI · URGENT): the first item of What needs
 *   attention (the daily Zcom AI summary, or the backend's attention rules
 *   when there is no summary, PRD-036 D15). The second item is the sentence;
 *   any others open under "+ N more". "Book the call" writes to the store's
 *   owner, "Open store" opens its page. "Written 5 Nov, 10:36 AM", and
 *   "from 4 Nov" in amber when the summary is from an earlier day.
 * - `NeedsYouBillingCard` (BILLING): the most overdue invoice due this week
 *   (read live), with Send reminder. Red dot when overdue, amber when due.
 *   The caller hides it without `platform:billing:read`.
 * - `NeedsYouOnboardingCard` (ONBOARDING): the store longest in setup ("stuck"
 *   after 7 days), with "Book a setup call" (writes to the owner).
 *
 * The "Book" buttons compose an email to the owner: there is no booking
 * calendar in the console. Without an owner email they open the store.
 */

import { useState, type ReactNode } from "react";

import { Button, ButtonLink, Orb, Skeleton, cx, formatDate, formatMoney, toneDotClasses, toneTextClasses } from "../../ui";
import { SendReminderDialog } from "../../clients/stores-list/SendReminderDialog";
import {
  aiCardFallbackSentence,
  aiCardParts,
  bulletStoreLinks,
  developmentDetail,
  summaryState,
} from "../../../lib/home-attention.util";
import { FIRST_SUMMARY_COPY, formatIst, moneyDueWhen } from "../../../lib/platform-insights.util";
import { SETUP_STALLED_DAYS } from "../../../lib/sa-home.util";
import { useClients } from "../../../providers/ClientsProvider";
import type { Client } from "../../../types";
import type { PlatformAttention, PlatformAttentionSummary, PlatformMetricsStoreRow } from "../../../types/platform-insights";

/** The Stores page's saved views. */
export const AT_RISK_STORES_HREF = "/stores?view=at-risk";
export const IN_SETUP_STORES_HREF = "/stores?tab=setup";

// ─── Frame ────────────────────────────────────────────────────────────────

type Dot = "danger" | "warning" | null;

function ActionCard({
  eyebrow,
  dot,
  ai = false,
  label,
  children,
}: {
  eyebrow: ReactNode;
  dot?: Dot;
  ai?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cx(
        "flex h-full min-w-0 flex-col gap-2 rounded-card-lg border px-5 py-4.5",
        ai ? "border-ai-tint-border bg-linear-to-b from-ai-tint to-surface to-60%" : "border-line bg-surface",
      )}
    >
      <span className={cx("flex items-center gap-2 font-mono text-micro uppercase", ai ? "text-brand-text" : "text-fg-muted")}>
        {ai ? <Orb /> : dot ? <span aria-hidden className={cx("size-1.5 shrink-0 rounded-full", toneDotClasses[dot])} /> : null}
        {eyebrow}
      </span>
      {children}
    </section>
  );
}

function Headline({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <h3 className="text-title-3 text-fg" title={title}>
      {children}
    </h3>
  );
}

function Sentence({ children }: { children: ReactNode }) {
  return <p className="text-label text-fg-muted">{children}</p>;
}

/** The buttons sit at the bottom so the three cards line up. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-wrap gap-2 pt-2">{children}</div>;
}

function LoadingBody() {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <Skeleton className="h-5 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** An email to the store's owner about a call; null without an owner email. */
function callHref(client: Client | undefined, subject: string): string | null {
  const email = client?.ownerEmail?.trim();
  if (!email || email === "—" || !email.includes("@")) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

/** "Book the call" / "Book a setup call": the owner email, else the store page. */
function BookCallButton({
  client,
  storeId,
  subject,
  label,
  variant,
}: {
  client: Client | undefined;
  storeId: string;
  subject: string;
  label: string;
  variant: "primary" | "secondary";
}) {
  const href = callHref(client, subject);
  if (!href) {
    return (
      <ButtonLink variant={variant} size="sm" to={`/stores/${storeId}`}>
        {label}
      </ButtonLink>
    );
  }
  return (
    <Button variant={variant} size="sm" onPress={() => (window.location.href = href)}>
      {label}
    </Button>
  );
}

/** "2026-11-05" (the summary's IST day) as "5 Nov"; never an ISO date in the UI (G13). */
function dayOf(value: string): string {
  return formatDate(new Date(`${value}T00:00:00`));
}

// ─── Zcom AI · Urgent ─────────────────────────────────────────────────────

export function NeedsYouAiCard({
  summary,
  storeNames,
  isLoading = false,
}: {
  summary: PlatformAttentionSummary | null;
  storeNames: Map<string, string>;
  isLoading?: boolean;
}) {
  const { getClient } = useClients();
  const [showAll, setShowAll] = useState(false);
  const state = summaryState(summary);
  const items = state.kind === "bullets" ? state.items : [];
  // Round 3 E5: the sentence is about the headline's store; other stores' items go under "+ N more"
  const { headline: first, sentence: second, rest } = aiCardParts(items);
  const store = first ? bulletStoreLinks(first.storeIds, storeNames)[0] : undefined;
  const client = store ? getClient(store.tenantId) : undefined;
  const storeName = client?.storeName ?? (store && store.name !== "Open store" ? store.name : undefined);

  return (
    <ActionCard ai eyebrow={items.length ? "Zcom AI · Urgent" : "Zcom AI"} label="What needs attention">
      {isLoading ? (
        <LoadingBody />
      ) : state.kind === "none" ? (
        <>
          <Headline>Nothing to report yet.</Headline>
          <Sentence>{FIRST_SUMMARY_COPY}.</Sentence>
        </>
      ) : state.kind === "empty" ? (
        <>
          <Headline>Nothing needs attention today.</Headline>
          <Sentence>Zcom AI checks payments, setup and checkouts every morning.</Sentence>
        </>
      ) : (
        <>
          <Headline title={first?.metricKeys.length ? `Metrics: ${first.metricKeys.join(", ")}` : undefined}>{first?.text}</Headline>
          <Sentence>{second ? second.text : aiCardFallbackSentence(storeName, rest.length)}</Sentence>
          {rest.length ? (
            showAll ? (
              <ul className="flex flex-col gap-1.5">
                {rest.map((item, index) => (
                  <li key={index} className="text-label text-fg-muted">
                    {item.text}
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                className="self-start text-caption font-medium text-brand-text underline-offset-2 hover:underline"
                onClick={() => setShowAll(true)}
              >
                + {plural(rest.length, "more thing", "more things")}
              </button>
            )
          ) : null}
          {store ? (
            <Actions>
              <BookCallButton
                client={client}
                storeId={store.tenantId}
                subject={`A quick call about ${storeName ?? "your store"}`}
                label="Book the call"
                variant="primary"
              />
              <ButtonLink variant="secondary" size="sm" to={`/stores/${store.tenantId}`}>
                {storeName ? `Open ${storeName}` : "Open store"}
              </ButtonLink>
            </Actions>
          ) : null}
        </>
      )}
      {!isLoading && summary && state.kind !== "none" ? (
        <p className={cx("text-caption text-fg-subtle", !store && "mt-auto")}>
          {summary.generatedAt ? `Written ${formatIst(summary.generatedAt)}` : "Written this morning"}
          {state.fromDate ? <span className={cx("ml-1", toneTextClasses.warning)}>· from {dayOf(state.fromDate)}</span> : null}
        </p>
      ) : null}
    </ActionCard>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────

export function NeedsYouBillingCard({
  moneyDue,
  isLoading = false,
}: {
  moneyDue: NonNullable<PlatformAttention["moneyDue"]> | null;
  isLoading?: boolean;
}) {
  const { getClient } = useClients();
  const [remind, setRemind] = useState<Client[]>([]);
  const rows = moneyDue?.items ?? [];
  const overdue = rows.filter((row) => row.overdue).length;
  const dot: Dot = overdue ? "danger" : rows.length ? "warning" : null;
  // The server sends the most overdue first.
  const top = rows[0];
  const client = top ? getClient(top.tenantId) : undefined;
  const others = rows.length - 1;

  return (
    <ActionCard eyebrow="Billing" dot={isLoading ? null : dot} label="Money due this week">
      {isLoading ? (
        <LoadingBody />
      ) : !top ? (
        <>
          <Headline>Nothing due this week.</Headline>
          <Sentence>Invoices due in the next 7 days, and any overdue, show up here.</Sentence>
          <Actions>
            <ButtonLink variant="secondary" size="sm" to="/subscriptions">
              Open billing
            </ButtonLink>
          </Actions>
        </>
      ) : (
        <>
          <Headline>
            {top.overdue
              ? `${top.name}'s payment is ${plural(top.daysOverdue, "day", "days")} late`
              : `${top.name}'s ${formatMoney(top.amount, { whole: true })} is ${moneyDueWhen(top).replace(/^Due on/, "due")}`}
          </Headline>
          <Sentence>
            {top.overdue
              ? `${formatMoney(top.amount, { whole: true })} is overdue${top.invoiceCount > 1 ? ` on ${top.invoiceCount} invoices` : ""}.`
              : "Send a reminder before it's late."}
            {others > 0 ? ` ${plural(others, "more store", "more stores")} due this week · ${formatMoney(moneyDue!.total, { whole: true })} in all.` : ""}
          </Sentence>
          <Actions>
            {client ? (
              <Button variant="secondary" size="sm" onPress={() => setRemind([client])}>
                Send reminder
              </Button>
            ) : null}
            {others > 0 || !client ? (
              <ButtonLink variant={client ? "ghost" : "secondary"} size="sm" to={client ? "/subscriptions" : `/stores/${top.tenantId}/billing`}>
                {client ? `See all ${rows.length}` : "Open billing"}
              </ButtonLink>
            ) : null}
          </Actions>
          <SendReminderDialog key={remind.map((store) => store.id).join(",")} stores={remind} onClose={() => setRemind([])} />
        </>
      )}
    </ActionCard>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────

/** The store longest in setup (the server's `days` since it was created). */
function longestInSetup(rows: readonly PlatformMetricsStoreRow[]): PlatformMetricsStoreRow | undefined {
  return [...rows].sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || a.name.localeCompare(b.name))[0];
}

export function NeedsYouOnboardingCard({
  development,
  atRiskCount = 0,
  isLoading = false,
}: {
  development: PlatformAttention["development"] | null;
  /** Shown as a link so the at-risk list stays one click from Home. */
  atRiskCount?: number;
  isLoading?: boolean;
}) {
  const { getClient } = useClients();
  const rows = development?.items ?? [];
  const total = development?.totalCount ?? 0;
  const top = longestInSetup(rows);
  const client = top ? getClient(top.tenantId) : undefined;
  const name = client?.storeName ?? top?.name;
  const days = top?.days ?? null;
  const stuck = days != null && days > SETUP_STALLED_DAYS;

  return (
    <ActionCard eyebrow="Onboarding" dot={isLoading || !top ? null : "warning"} label="Stores in setup">
      {isLoading ? (
        <LoadingBody />
      ) : !top ? (
        <>
          <Headline>No stores in setup.</Headline>
          <Sentence>New stores show here until they go live.</Sentence>
        </>
      ) : (
        <>
          <Headline>{stuck ? `${name} is stuck at setup` : `${name} is in setup`}</Headline>
          <Sentence>
            {[days != null ? `${plural(days, "day", "days")} in setup` : null, developmentDetail(top)].filter(Boolean).join(" · ")}.
            {total > 1 ? ` ${plural(total - 1, "more store", "more stores")} in setup.` : ""}
          </Sentence>
          <Actions>
            <BookCallButton
              client={client}
              storeId={top.tenantId}
              subject={`A setup call for ${name ?? "your store"}`}
              label="Book a setup call"
              variant="secondary"
            />
            {total > 1 ? (
              <ButtonLink variant="ghost" size="sm" to={IN_SETUP_STORES_HREF}>
                See all {total}
              </ButtonLink>
            ) : null}
          </Actions>
        </>
      )}
      {!isLoading && atRiskCount > 0 ? (
        <ButtonLink variant="ghost" size="sm" to={AT_RISK_STORES_HREF} className={cx("self-start", !top && "mt-auto")}>
          {plural(atRiskCount, "store", "stores")} at risk
        </ButtonLink>
      ) : null}
    </ActionCard>
  );
}
