/**
 * Home › Needs you (design v2 §7, board 02-V4-SA-Home): three cards in a row.
 *
 * - `NeedsYouAiCard`: What needs attention (backend PRD-026 FR-5), the
 *   bullets Zcom AI writes each morning (about 08:45 IST). Light blue, the
 *   orb; the first bullet is the headline, the rest follow, and the stores a
 *   bullet names link to their pages. "Written <IST>", and "from <date>" in
 *   amber when the summary is from an earlier IST day.
 * - `NeedsYouBillingCard`: money due this week (read live: open invoices due
 *   within 7 days, overdue included, most overdue first). White with a red dot
 *   when anything is overdue, amber otherwise. The caller hides it without
 *   `platform:billing:read`.
 * - `NeedsYouStoresCard`: stores at risk (score and reasons) and stores in
 *   setup (days since creation, planned go-live), the first three of each,
 *   with "+ N more" into the Stores views.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { ButtonLink, Orb, Skeleton, StatusChip, cx, formatMoney, toneDotClasses, toneTextClasses } from "../../ui";
import { bulletStoreLinks, developmentDetail, moreCount, sortAtRisk, summaryState } from "../../../lib/home-attention.util";
import { FIRST_SUMMARY_COPY, formatIst, moneyDueWhen, riskReasonLabel } from "../../../lib/platform-insights.util";
import type { PlatformAttention, PlatformAttentionSummary, PlatformMetricsStoreRow } from "../../../types/platform-insights";

/** The Stores page's saved views. */
export const AT_RISK_STORES_HREF = "/stores?view=at-risk";
export const IN_SETUP_STORES_HREF = "/stores?tab=setup";

/** Rows shown per list before "+ N more". */
const ROWS_SHOWN = 3;

// ─── Frame ────────────────────────────────────────────────────────────────

type Dot = "danger" | "warning" | null;

function NeedsCard({
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
        "flex min-w-0 flex-col gap-2 rounded-card-lg border px-5 py-4.5",
        ai ? "border-ai-tint-border bg-linear-to-b from-ai-tint to-surface to-60%" : "border-line bg-surface",
      )}
    >
      <span className={cx("flex items-center gap-2 text-micro", ai ? "text-brand-text" : "text-fg-muted")}>
        {ai ? <Orb /> : dot ? <span aria-hidden className={cx("size-1.5 shrink-0 rounded-full", toneDotClasses[dot])} /> : null}
        {eyebrow}
      </span>
      {children}
    </section>
  );
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

const storeCount = (count: number) => `${count} ${count === 1 ? "store" : "stores"}`;

// ─── Zcom AI: What needs attention ────────────────────────────────────────

export function NeedsYouAiCard({
  summary,
  storeNames,
  isLoading = false,
}: {
  summary: PlatformAttentionSummary | null;
  storeNames: Map<string, string>;
  isLoading?: boolean;
}) {
  const state = summaryState(summary);
  const [first, ...rest] = state.kind === "bullets" ? state.items : [];
  const firstLinks = first ? bulletStoreLinks(first.storeIds, storeNames) : [];

  return (
    <NeedsCard ai eyebrow="Zcom AI · What needs attention" label="What needs attention">
      {isLoading ? (
        <LoadingBody />
      ) : state.kind === "none" ? (
        <p className="text-label text-fg-muted">{FIRST_SUMMARY_COPY}.</p>
      ) : state.kind === "empty" ? (
        <h3 className="text-title-3 text-fg">Nothing needs attention today.</h3>
      ) : (
        <>
          <h3 className="text-title-3 text-fg" title={first.metricKeys.length ? `Metrics: ${first.metricKeys.join(", ")}` : undefined}>
            {first.text}
          </h3>
          {rest.length ? (
            <ul className="flex flex-col gap-1.5">
              {rest.map((item, index) => {
                const links = bulletStoreLinks(item.storeIds, storeNames);
                return (
                  <li key={index} className="text-label text-fg-muted">
                    <span title={item.metricKeys.length ? `Metrics: ${item.metricKeys.join(", ")}` : undefined}>{item.text}</span>
                    {links.map((link) => (
                      <Link
                        key={link.tenantId}
                        to={`/stores/${link.tenantId}`}
                        className="ml-2 font-medium text-brand-text underline-offset-2 hover:underline"
                      >
                        {link.name}
                      </Link>
                    ))}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {firstLinks.length ? (
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              {firstLinks.map((link) => (
                <ButtonLink key={link.tenantId} variant="secondary" size="sm" to={`/stores/${link.tenantId}`}>
                  {link.name}
                </ButtonLink>
              ))}
            </div>
          ) : null}
        </>
      )}
      {!isLoading && summary && state.kind !== "none" ? (
        <p className={cx("text-caption text-fg-subtle", !firstLinks.length && "mt-auto")}>
          {summary.generatedAt ? `Written ${formatIst(summary.generatedAt)}` : "Written this morning"}
          {state.fromDate ? <span className={cx("ml-1", toneTextClasses.warning)}>· from {state.fromDate}</span> : null}
        </p>
      ) : null}
    </NeedsCard>
  );
}

// ─── Billing: money due this week ─────────────────────────────────────────

export function NeedsYouBillingCard({
  moneyDue,
  isLoading = false,
}: {
  moneyDue: NonNullable<PlatformAttention["moneyDue"]> | null;
  isLoading?: boolean;
}) {
  const rows = moneyDue?.items ?? [];
  const overdue = rows.filter((row) => row.overdue).length;
  const shown = rows.slice(0, ROWS_SHOWN);
  const more = rows.length - shown.length;
  const dot: Dot = overdue ? "danger" : rows.length ? "warning" : null;

  return (
    <NeedsCard eyebrow="Billing" dot={isLoading ? null : dot} label="Money due this week">
      {isLoading ? (
        <LoadingBody />
      ) : !moneyDue || rows.length === 0 ? (
        <>
          <h3 className="text-title-3 text-fg">Nothing due this week.</h3>
          <p className="text-label text-fg-muted">Invoices due in the next 7 days, and any overdue, show up here.</p>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-title-3 text-fg">
              <span className="num">{formatMoney(moneyDue.total, { whole: true })}</span> due this week
            </h3>
            <p className="text-label text-fg-muted">
              From {storeCount(moneyDue.storeCount)}
              {overdue ? (
                <>
                  {" · "}
                  <span className={cx("font-medium", toneTextClasses.danger)}>{overdue} overdue</span>
                </>
              ) : null}
            </p>
          </div>
          <ul className="flex flex-col">
            {shown.map((row) => (
              <li key={row.tenantId} className="border-t border-line-subtle first:border-t-0">
                <Link
                  to={`/stores/${row.tenantId}/billing`}
                  className="group flex items-center gap-3 rounded-field py-2 outline-none focus-visible:shadow-focus-strong"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-strong text-fg group-hover:text-brand-text">{row.name}</span>
                    <span className="block truncate text-caption text-fg-subtle">
                      {moneyDueWhen(row)}
                      {row.invoiceCount > 1 ? ` · ${row.invoiceCount} invoices` : ""}
                    </span>
                  </span>
                  {row.overdue ? <StatusChip domain="payment" status="overdue" /> : null}
                  <span className="num shrink-0 text-label-strong text-fg">{formatMoney(row.amount, { whole: true })}</span>
                </Link>
              </li>
            ))}
          </ul>
          {more > 0 ? (
            <div className="mt-auto pt-1">
              <ButtonLink variant="secondary" size="sm" to="/subscriptions">
                See all {rows.length}
              </ButtonLink>
            </div>
          ) : null}
        </>
      )}
    </NeedsCard>
  );
}

// ─── Stores: at risk and in setup ─────────────────────────────────────────

type StoreList = PlatformAttention["atRisk"];

function StoreGroup({
  title,
  list,
  href,
  empty,
  detail,
}: {
  title: string;
  list: StoreList;
  href: string;
  empty: string;
  detail: (row: PlatformMetricsStoreRow) => string;
}) {
  const shown = list.items.slice(0, ROWS_SHOWN);
  const more = moreCount(list.totalCount, shown.length);
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-label-strong text-fg">
          {title} <span className="num text-fg-subtle">· {list.totalCount}</span>
        </h3>
        {more > 0 ? (
          <Link to={href} className="text-caption font-medium text-brand-text underline-offset-2 hover:underline">
            + {more} more
          </Link>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="py-1.5 text-caption text-fg-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((row) => (
            <li key={row.tenantId} className="flex min-w-0 items-baseline gap-2 py-1">
              <Link
                to={`/stores/${row.tenantId}`}
                className="min-w-0 shrink truncate text-label font-medium text-fg underline-offset-2 hover:underline"
              >
                {row.name}
              </Link>
              <span className="min-w-0 flex-1 truncate text-caption text-fg-subtle" title={detail(row)}>
                {detail(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const riskDetail = (row: PlatformMetricsStoreRow) =>
  [`Score ${row.score ?? 0}`, ...(row.reasons ?? []).map(riskReasonLabel)].join(" · ");

const setupDetail = (row: PlatformMetricsStoreRow) =>
  [row.days == null ? null : `${row.days} ${row.days === 1 ? "day" : "days"}`, developmentDetail(row)].filter(Boolean).join(" · ");

export function NeedsYouStoresCard({
  atRisk,
  development,
  isLoading = false,
}: {
  atRisk: StoreList | null;
  development: StoreList | null;
  isLoading?: boolean;
}) {
  const risk: StoreList = { totalCount: atRisk?.totalCount ?? 0, items: sortAtRisk(atRisk?.items ?? []) };
  const setup: StoreList = { totalCount: development?.totalCount ?? 0, items: development?.items ?? [] };
  const dot: Dot = risk.totalCount || setup.totalCount ? "warning" : null;

  return (
    <NeedsCard eyebrow="Stores · At risk and in setup" dot={isLoading ? null : dot} label="Stores at risk and in setup">
      {isLoading ? (
        <LoadingBody />
      ) : (
        <div className="flex flex-col gap-3">
          <StoreGroup title="At risk" list={risk} href={AT_RISK_STORES_HREF} empty="No stores at risk." detail={riskDetail} />
          <StoreGroup
            title="In setup"
            list={setup}
            href={IN_SETUP_STORES_HREF}
            empty="No stores in development."
            detail={setupDetail}
          />
        </div>
      )}
    </NeedsCard>
  );
}
