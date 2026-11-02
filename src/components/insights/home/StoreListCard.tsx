/**
 * Home blocks 2 and 4 (backend PRD-026 FR-7.1, guide §3, §7):
 * - `AtRiskCard`: one line per store at risk, its reasons as tags, highest
 *   score first. Under the small-sample threshold the server sends every
 *   store; above it the top 10, so "+ N more" links to Stores › At risk.
 * - `DevelopmentCard`: stores created and not live yet, days since
 *   creation and the planned go-live.
 * Store names link to the store page.
 */

import { Link } from "react-router-dom";

import { ButtonLink, Card, Chip, Skeleton } from "../../ui";
import { developmentDetail, moreCount, sortAtRisk } from "../../../lib/home-attention.util";
import { riskReasonLabel } from "../../../lib/platform-insights.util";
import type { PlatformAttention } from "../../../types/platform-insights";

type StoreList = PlatformAttention["atRisk"];

/** The Stores page's saved view for at-risk stores. */
export const AT_RISK_STORES_HREF = "/stores?view=at-risk";

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2 px-5 pb-5">
      <Skeleton className="h-6 w-full rounded-md" />
      <Skeleton className="h-6 w-full rounded-md" />
    </div>
  );
}

export function AtRiskCard({ list, isLoading = false }: { list: StoreList | null; isLoading?: boolean }) {
  const rows = sortAtRisk(list?.items ?? []);
  const more = moreCount(list?.totalCount ?? 0, rows.length);
  return (
    <Card
      title="Stores at risk"
      description={isLoading || !list ? undefined : `${list.totalCount} ${list.totalCount === 1 ? "store" : "stores"}`}
      actions={
        more > 0 ? (
          <ButtonLink variant="tertiary" size="sm" to={AT_RISK_STORES_HREF}>
            + {more} more
          </ButtonLink>
        ) : undefined
      }
      padding="none"
    >
      {isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-body text-fg-muted">No stores at risk.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <li key={row.tenantId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
              <Link
                to={`/stores/${row.tenantId}`}
                className="min-w-0 truncate text-body font-medium text-fg underline-offset-2 hover:underline"
              >
                {row.name}
              </Link>
              <span className="text-caption text-fg-muted num">Score {row.score ?? 0}</span>
              <span className="flex flex-wrap gap-1.5">
                {(row.reasons ?? []).map((reason) => (
                  <Chip key={reason} tone="warning" dot={false}>
                    {riskReasonLabel(reason)}
                  </Chip>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DevelopmentCard({ list, isLoading = false }: { list: StoreList | null; isLoading?: boolean }) {
  const rows = list?.items ?? [];
  const more = moreCount(list?.totalCount ?? 0, rows.length);
  return (
    <Card
      title="New and in development"
      description={isLoading || !list ? undefined : `${list.totalCount} ${list.totalCount === 1 ? "store" : "stores"}`}
      actions={
        more > 0 ? (
          <ButtonLink variant="tertiary" size="sm" to="/stores?view=in-development">
            + {more} more
          </ButtonLink>
        ) : undefined
      }
      padding="none"
    >
      {isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-body text-fg-muted">No stores in development.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <li key={row.tenantId} className="flex items-center gap-3 px-5 py-3">
              <Link
                to={`/stores/${row.tenantId}`}
                className="min-w-0 flex-1 truncate text-body font-medium text-fg underline-offset-2 hover:underline"
              >
                {row.name}
              </Link>
              <span className="shrink-0 text-caption text-fg-muted num">
                {row.days == null ? "—" : `${row.days} ${row.days === 1 ? "day" : "days"}`}
              </span>
              <span className="w-56 shrink-0 truncate text-right text-caption text-fg-muted max-sm:hidden">
                {developmentDetail(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
